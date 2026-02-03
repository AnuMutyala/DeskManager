import {
	bookings,
	seats,
	users,
	type Booking,
	type InsertSeat,
	type InsertUser,
	type Seat,
	type User
} from "@shared/schema";
import { and, desc,asc, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;

  // Seat
  getSeats(): Promise<Seat[]>;
  getSeat(id: number): Promise<Seat | undefined>;
  createSeat(seat: InsertSeat): Promise<Seat>;
  updateSeat(id: number, seat: Partial<InsertSeat>): Promise<Seat>;
  deleteSeat(id: number): Promise<void>;

  // Booking
  getBookings(filters?: { date?: string; start?: string; end?: string; userId?: number }): Promise<(Booking & { seat: Seat; user: User })[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<void>;

  // Custom checks
  isSeatAvailable(seatId: number, date: string, slot: string): Promise<boolean>;
  // Create recurring bookings. Returns {ok:true, bookings} on success or {ok:false, conflicts}
  createRecurringBookings(userId: number, seatId: number, startDate: string, occurrences?: number, intervalWeeks?: number, slot?: string): Promise<{ ok: true; bookings: Booking[] } | { ok: false; conflicts: string[] }>;
  // Create bookings for an explicit list of dates
  createBookingsForDates(userId: number, seatId: number, dates: string[], slot?: string): Promise<{ ok: true; bookings: Booking[] } | { ok: false; conflicts: string[] }>;
}

export class DatabaseStorage implements IStorage {
  // User
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(userUpdate).where(eq(users.id, id)).returning();
    return user;
  }

  // Seat
  async getSeats(): Promise<Seat[]> {
    return await db.select().from(seats);
  }

  async getSeat(id: number): Promise<Seat | undefined> {
    const [seat] = await db.select().from(seats).where(eq(seats.id, id));
    return seat;
  }

  async createSeat(insertSeat: InsertSeat): Promise<Seat> {
    const [seat] = await db.insert(seats).values(insertSeat as any).returning();
    return seat;
  }

  async updateSeat(id: number, seatUpdate: Partial<InsertSeat>): Promise<Seat> {
    const [seat] = await db.update(seats).set(seatUpdate as any).where(eq(seats.id, id)).returning();
    return seat;
  }

  async deleteSeat(id: number): Promise<void> {
    await db.delete(seats).where(eq(seats.id, id));
  }

  // Booking
  async getBookings(filters?: { date?: string; start?: string; end?: string; userId?: number }): Promise<(Booking & { seat: Seat; user: User })[]> {

		let query = db
    .select()
    .from(bookings)
    .leftJoin(seats, eq(bookings.seatId, seats.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .orderBy(desc(bookings.createdAt)); // ← maps to created_at

    const conditions: any[] = [];
    if (filters?.date) {
      conditions.push(eq(bookings.date, filters.date));
    }
    if (filters?.start) {
      conditions.push(gte(bookings.date, filters.start));
    }
    if (filters?.end) {
      conditions.push(lte(bookings.date, filters.end));
    }
    if (filters?.userId) {
      conditions.push(eq(bookings.userId, filters.userId));
    }

    if (conditions.length > 0) {
      // @ts-ignore - complex type inference with drizzle
      query = query.where(and(...conditions));
    }

    const result = await query;
    // Map result to simpler structure if needed, or return joined result.
    // The type signature expects (Booking & { seat: Seat; user: User }).
    // The result from join is { bookings: Booking, seats: Seat, users: User }

    return result.map(row => {
      const { password, ...userWithoutPassword } = row.users!;
      return {
        ...row.bookings!,
        seat: row.seats!,
        user: userWithoutPassword as any
      };
    }) as any;
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  // single-create removed in favor of `createBookingsForDates`

  async deleteBooking(id: number): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async isSeatAvailable(seatId: number, date: string, slot: "AM" | "PM" | "FULL"): Promise<boolean> {
    // Check if seat is blocked on this date
    const seat = await this.getSeat(seatId);
    if (!seat) return false;

    // Check if seat has a date-range block
    if (seat.blockStartDate && seat.blockEndDate) {
      // Only check if booking date falls within the blocked date range
      if (date >= seat.blockStartDate && date <= seat.blockEndDate) {
        return false;
      }
    } else if (seat.isBlocked) {
      // No date range, so it's permanently blocked
      return false;
    }

    // Get all existing bookings for this seat and date
    const existing = await db.select().from(bookings).where(
      and(
        eq(bookings.seatId, seatId),
        eq(bookings.date, date)
      )
    );

    // If requesting FULL day, check if either AM, PM, or FULL is already booked
    if (slot === 'FULL') {
      return existing.length === 0;
    }

    // For AM or PM, check if that specific slot or FULL is booked
    const hasConflict = existing.some(b =>
      b.slot === slot || b.slot === 'FULL'
    );

    return !hasConflict;
  }

  async createRecurringBookings(userId: number, seatId: number, startDate: string, occurrences = 1, intervalWeeks = 1, slot: "AM" | "PM" | "FULL" = 'AM'): Promise<{ ok: true; bookings: Booking[] } | { ok: false; conflicts: string[] }> {
    const { addWeeks, parseISO, format } = await import('date-fns');

    // validate seat exists
    const seat = await this.getSeat(seatId);
    if (!seat) return { ok: false, conflicts: [`Seat ${seatId} not found`] };

    const dates: string[] = [];
    const base = parseISO(startDate);
    for (let i = 0; i < occurrences; i++) {
      const d = addWeeks(base, i * intervalWeeks);
      dates.push(format(d, 'yyyy-MM-dd'));
    }

    const conflicts: string[] = [];
    for (const d of dates) {
      const available = await this.isSeatAvailable(seatId, d, slot);
      if (!available) conflicts.push(d);
    }

    if (conflicts.length > 0) {
      return { ok: false, conflicts };
    }

    const created: Booking[] = [];
    for (const d of dates) {
      const [booking] = await db.insert(bookings).values({ userId, seatId, date: d, slot }).returning();
      created.push(booking);
    }

    return { ok: true, bookings: created };
  }

  async createBookingsForDates(userId: number, seatId: number, dates: string[], slot: "AM" | "PM" | "FULL" = 'AM'): Promise<{ ok: true; bookings: Booking[] } | { ok: false; conflicts: string[] }> {
    // validate seat exists
    const seat = await this.getSeat(seatId);
    if (!seat) return { ok: false, conflicts: [`Seat ${seatId} not found`] };

    const conflicts: string[] = [];
    for (const d of dates) {
      const available = await this.isSeatAvailable(seatId, d, slot);
      if (!available) conflicts.push(d);
    }

    if (conflicts.length > 0) return { ok: false, conflicts };

    const created: Booking[] = [];
    for (const d of dates) {
      const [booking] = await db.insert(bookings).values({ userId, seatId, date: d, slot }).returning();
      created.push(booking);
    }

    return { ok: true, bookings: created };
  }
}

export const storage = new DatabaseStorage();
