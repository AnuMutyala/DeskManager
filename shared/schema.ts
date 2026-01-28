import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "employee"] })
    .notNull()
    .default("employee"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const seats = pgTable("seats", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(), // e.g., T56
  type: text("type", { enum: ["regular", "standing"] })
    .notNull()
    .default("regular"),
  tags: jsonb("tags").$type<string[]>(), // e.g., ["near window", "monitor"]
  isBlocked: boolean("is_blocked").default(false),
  gridX: integer("grid_x").notNull().default(0), // Grid column position
  gridY: integer("grid_y").notNull().default(0), // Grid row position
  gridWidth: integer("grid_width").notNull().default(2), // Width in grid units (default 2)
  gridHeight: integer("grid_height").notNull().default(2), // Height in grid units (default 2)
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  seatId: integer("seat_id")
    .references(() => seats.id)
    .notNull(),
  date: date("date").notNull(), // YYYY-MM-DD
  slot: text("slot", { enum: ["AM", "PM", "FULL"] }).notNull(), // Added FULL for convenience if needed, but scope says AM/PM. Let's stick to simple.
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertSeatSchema = createInsertSchema(seats).omit({
  id: true,
  createdAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Seat = typeof seats.$inferSelect;
export type InsertSeat = z.infer<typeof insertSeatSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
