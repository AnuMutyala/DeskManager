import { api } from "@shared/routes";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import { promises as fs } from "fs";
import { type Server } from "http";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: "admin" | "employee";
      };
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- JWT Auth Setup ---
  const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";

  // parse cookies so we can optionally accept token via cookie
  app.use(cookieParser());

  const generateToken = (user: any) => {
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  };

  const getTokenFromReq = (req: any) => {
    const auth = req.headers?.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    // fallback to cookie 'token' if client sets it
    return req.cookies?.token;
  };

  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const token = getTokenFromReq(req);
      if (!token) return res.status(401).json({ message: 'Unauthorized' });
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = await storage.getUser(decoded.id);
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      await requireAuth(req, res, async () => {
        if (req.user && req.user.role === 'admin') return next();
        res.status(403).json({ message: 'Forbidden' });
      });
    } catch (err) {
      res.status(403).json({ message: 'Forbidden' });
    }
  };

  // --- Auth Routes (JWT) ---
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });
      const matches = (await bcrypt.compare(password, user.password)) || password === user.password;
      if (!matches) return res.status(401).json({ message: 'Invalid credentials' });
      // If password was stored in plain text, re-hash it for future safety
      if (!user.password.startsWith('$2')) {
        try {
          const hashed = await bcrypt.hash(password, 10);
          await storage.updateUser(user.id, { password: hashed } as any);
          user.password = hashed;
        } catch (err) {
          console.warn('Failed to re-hash password on login:', err);
        }
      }
      const token = generateToken(user);
      res.json({ token, user });
    } catch (err) {
      console.error('Login error', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    // Stateless JWT - instruct client to drop token
    res.sendStatus(200);
  });

  app.get(api.auth.me.path, requireAuth, (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      console.log('Register request body:', req.body);
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      const hashed = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({ username: input.username, password: hashed, role: input.role } as any);
      console.log('Created user:', { id: user.id, username: user.username, role: user.role });
      const token = generateToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Register error', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // --- API Routes ---

  // (moved up) requireAuth and requireAdmin now use JWT

  // Seats
  app.get(api.seats.list.path, requireAuth, async (req, res) => {
    const seats = await storage.getSeats();
    res.json(seats);
  });

  // Default layout persistence
  app.get('/api/layout/default', requireAdmin, async (req, res) => {
    try {
      const raw = await fs.readFile(new URL('./defaultLayout.json', import.meta.url));
      const data = JSON.parse(raw.toString());
      res.json(data);
    } catch (err) {
      console.error('Failed to read default layout:', err);
      res.status(500).json({ message: 'Failed to read default layout' });
    }
  });

  app.post('/api/layout/default', requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      // Basic validation: expect array of { id?, label?, x, y }
      if (!Array.isArray(body)) return res.status(400).json({ message: 'Invalid payload' });
      const ok = body.every((b: any) => (typeof b.id === 'number' || typeof b.label === 'string') && typeof b.x === 'number' && typeof b.y === 'number');
      if (!ok) return res.status(400).json({ message: 'Invalid layout format' });
      // Normalize entries to include label if present and numbers for x/y
      // Persist only label + x/y to avoid keeping stale DB ids which can change
      const normalized = body.map((b: any) => ({ label: typeof b.label === 'string' ? b.label : undefined, x: Math.round(b.x), y: Math.round(b.y) }));
      await fs.writeFile(new URL('./defaultLayout.json', import.meta.url), JSON.stringify(normalized, null, 2));
      res.status(200).json({ message: 'Saved' });
    } catch (err) {
      console.error('Failed to save default layout:', err);
      res.status(500).json({ message: 'Failed to save default layout' });
    }
  });

  app.post(api.seats.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.seats.create.input.parse(req.body);
      const seat = await storage.createSeat(input);
      res.status(201).json(seat);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if ((err as any)?.code === "23505") {
        res.status(409).json({ message: "Seat label already exists" });
      } else {
        console.error("Create seat error:", err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.seats.update.path, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      console.log("Update seat request body:", JSON.stringify(req.body, null, 2));
      const input = api.seats.update.input.parse(req.body);
      console.log("Parsed input:", JSON.stringify(input, null, 2));
      const seat = await storage.updateSeat(id, input);
      console.log("Updated seat:", JSON.stringify(seat, null, 2));
      if (!seat) return res.status(404).json({ message: "Seat not found" });
      res.json(seat);
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Update seat error:", err);
        // Include error message when available to help client debugging
        const message = (err as any)?.message || "Internal Server Error";
        res.status(500).json({ message });
      }
    }
  });

  app.delete(api.seats.delete.path, requireAdmin, async (req, res) => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    await storage.deleteSeat(id);
    res.sendStatus(200);
  });

  // Bookings
  app.get(api.bookings.list.path, requireAuth, async (req, res) => {
    const filters: any = {};
    if (req.query.date) filters.date = req.query.date as string;
    if (req.query.start) filters.start = req.query.start as string;
    if (req.query.end) filters.end = req.query.end as string;
    if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
    const bookings = await storage.getBookings(filters);
    res.json(bookings);
  });

  // Single booking create route removed; use `/api/bookings/recurring` with an explicit `dates` array instead.

  // Recurring bookings endpoint
  app.post(api.bookings.recurring.path, requireAuth, async (req, res) => {
    try {
      console.log('=== RECURRING BOOKING DEBUG ===');
      console.log('Raw request body:', req.body);
      console.log('Body keys:', Object.keys(req.body || {}));
      console.log('User ID:', req.user?.id);
      console.log('seatId:', req.body?.seatId, 'type:', typeof req.body?.seatId);
      console.log('dates:', req.body?.dates);
      console.log('slot:', req.body?.slot);
      console.log('==============================');

      const input = api.bookings.recurring.input.parse(req.body);
      console.log('Parsed input successfully:', input);

      if (input.dates && Array.isArray(input.dates) && input.dates.length > 0) {
        const result = await storage.createBookingsForDates(req.user!.id, input.seatId, input.dates, input.slot);
        if (!result.ok) {
          return res.status(409).json({ message: 'One or more dates are unavailable', conflicts: result.conflicts });
        }
        return res.status(201).json(result.bookings);
      }
        // Single booking create route removed; use `/api/bookings/recurring` with an explicit `dates` array instead.

      const occurrences = input.occurrences ?? 1;
      const intervalWeeks = input.intervalWeeks ?? 1;

      const result = await storage.createRecurringBookings(req.user!.id, input.seatId, input.startDate || '', occurrences, intervalWeeks, input.slot);

      if (!result.ok) {
        return res.status(409).json({ message: 'One or more dates are unavailable', conflicts: result.conflicts });
      }

      res.status(201).json(result.bookings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error('=== ZOD VALIDATION ERROR ===');
        console.error('Full error:', JSON.stringify(err, null, 2));
        console.error('Error issues:', err.issues);
        console.error('===========================');
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
          errors: err.errors
        });
      }
      console.error('Recurring booking error:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  app.delete(api.bookings.cancel.path, requireAuth, async (req, res) => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const booking = await storage.getBooking(id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Allow user to delete their own booking, or admin to delete any
    if (booking.userId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await storage.deleteBooking(id);
    res.sendStatus(200);
  });

  // --- Seed Data ---
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUserByUsername("admin");
  if (!existingUsers) {
    console.log("Seeding database...");

    // Create Users
    const adminPass = await bcrypt.hash("password", 10);
    const empPass = await bcrypt.hash("password", 10);
    await storage.createUser({ username: "admin", password: adminPass, role: "admin" });
    await storage.createUser({ username: "employee", password: empPass, role: "employee" });

    // Create Seats (Sample from the image labels)
    const seatLabels = [
      "T56", "T55", "T54", "T53", "T49", "T50", "T51", "T52",
      "T48", "T47", "T46", "T45", "T41", "T42", "T43", "T44",
      "T60", "T61", "T59", "T62", "T58", "T63", "T57", "T64",
      "S1", "S2", "S3", "S4" // Standing desks maybe?
    ];

    for (const label of seatLabels) {
      await storage.createSeat({
        label,
        // S = solo desks (no monitor), T = team cluster desks (with monitors)
        type: label.startsWith("S") ? "STANDING" : "REGULAR",
        tags: [],
        isBlocked: false
      });
    }
    console.log("Seeding complete.");
  }

  // NOTE: seeding from defaultLayout.json is handled by the separate `script/seed.ts`.
}
