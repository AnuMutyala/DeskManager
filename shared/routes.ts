import { z } from 'zod';
import { insertUserSchema, insertSeatSchema, insertBookingSchema, users, seats, bookings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  conflict: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      // Use a lightweight validation for registration so very short usernames/passwords are allowed.
      // The DB still enforces uniqueness; consider enforcing stronger rules in production.
      input: z.object({ username: z.string().min(1), password: z.string().min(1), role: z.enum(['admin','employee']).optional() }),
      responses: {
        201: z.object({ user: z.custom<typeof users.$inferSelect>(), token: z.string() }),
        400: errorSchemas.validation,
        409: errorSchemas.conflict,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      input: z.object({}).optional(),
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  seats: {
    list: {
      method: 'GET' as const,
      path: '/api/seats',
      responses: {
        200: z.array(z.custom<typeof seats.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/seats',
      input: insertSeatSchema,
      responses: {
        201: z.custom<typeof seats.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/seats/:id',
      input: insertSeatSchema.partial(),
      responses: {
        200: z.custom<typeof seats.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/seats/:id',
      responses: {
        200: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  bookings: {
    list: {
      method: 'GET' as const,
      path: '/api/bookings',
      // Accept either a single `date` or a `start`/`end` range (YYYY-MM-DD)
      input: z.object({
        date: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        userId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect & { seat: typeof seats.$inferSelect; user: typeof users.$inferSelect }>()),
      },
    },
    // single create endpoint removed in favor of unified `recurring` API that accepts `dates`.
    recurring: {
      method: 'POST' as const,
      path: '/api/bookings/recurring',
      // Accept either an explicit `dates` array or recurrence parameters.
      input: z.object({
        seatId: z.number(),
        startDate: z.string().optional(), // YYYY-MM-DD
        dates: z.array(z.string()).optional(), // explicit dates in YYYY-MM-DD
        occurrences: z.number().min(1).optional(),
        intervalWeeks: z.number().min(1).optional(),
        slot: z.union([z.literal('AM'), z.literal('PM'), z.literal('FULL')])
      }),
      responses: {
        201: z.array(z.custom<typeof bookings.$inferSelect>()),
        400: errorSchemas.validation,
        409: errorSchemas.conflict,
      },
    },
    cancel: {
      method: 'DELETE' as const,
      path: '/api/bookings/:id',
      responses: {
        200: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
