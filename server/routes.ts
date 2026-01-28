import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import MemoryStore from "memorystore";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Auth Setup ---
  const SessionStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }
      // Simple password check for MVP (in production use hashing!)
      if (user.password !== password) {
        return done(null, false, { message: "Incorrect password." });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // --- Auth Routes ---
  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(input);
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json(user);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- API Routes ---

  // Middleware to check auth
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user.role === "admin") return next();
    res.status(403).json({ message: "Forbidden" });
  };

  // Seats
  app.get(api.seats.list.path, requireAuth, async (req, res) => {
    const seats = await storage.getSeats();
    res.json(seats);
  });
  app.post('/api/layout/default', requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      // Basic validation: expect array of { id?, label?, x, y }
      if (!Array.isArray(body)) return res.status(400).json({ message: 'Invalid payload' });
      const ok = body.every((b: any) => (typeof b.id === 'number' || typeof b.label === 'string') && typeof b.x === 'number' && typeof b.y === 'number');
      if (!ok) return res.status(400).json({ message: 'Invalid layout format' });
      // Normalize entries to include label if present and numbers for x/y
      const normalized = body.map((b: any) => ({ id: typeof b.id === 'number' ? b.id : undefined, label: typeof b.label === 'string' ? b.label : undefined, x: Math.round(b.x), y: Math.round(b.y) }));
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
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.seats.update.path, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.seats.update.input.parse(req.body);
      const seat = await storage.updateSeat(id, input);
      if (!seat) return res.status(404).json({ message: "Seat not found" });
      res.json(seat);
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.seats.delete.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteSeat(id);
    res.sendStatus(200);
  });

  // Bookings
  app.get(api.bookings.list.path, requireAuth, async (req, res) => {
    const filters = {
      date: req.query.date as string,
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined
    };
    const bookings = await storage.getBookings(filters);
    res.json(bookings);
  });

  app.post(api.bookings.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.bookings.create.input.parse(req.body);
      
      // Check availability
      const isAvailable = await storage.isSeatAvailable(input.seatId, input.date, input.slot);
      if (!isAvailable) {
        return res.status(409).json({ message: "Seat already booked for this slot" });
      }

      // Check seat blockage
      const seat = await storage.getSeat(input.seatId);
      if (seat?.isBlocked) {
        return res.status(409).json({ message: "Seat is blocked" });
      }

      const booking = await storage.createBooking({ ...input, userId: req.user.id });
      res.status(201).json(booking);
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.delete(api.bookings.cancel.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Allow user to delete their own booking, or admin to delete any
    if (booking.userId !== req.user.id && req.user.role !== "admin") {
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
    await storage.createUser({ username: "admin", password: "password", role: "admin" });
    await storage.createUser({ username: "employee", password: "password", role: "employee" });
    
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
        type: label.startsWith("S") ? "standing" : "regular",
        tags: [],
        isBlocked: false
      });
    }
    console.log("Seeding complete.");
  }
}
