/**
 * server/validators/event.validators.js
 * Zod schemas for event and booking request bodies.
 */
const { z } = require('zod');

const CATEGORIES = ['Tech', 'Sports', 'Business', 'Music', 'Art', 'Food', 'Other'];
const mongoId    = z.string().trim().length(24, 'Invalid ID');

// ── Event ─────────────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  title:      z.string().trim().min(3).max(120),
  description:z.string().trim().min(10).max(2000),
  date:       z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date')
               .refine((d) => new Date(d) > new Date(), 'Event date must be in the future'),
  time:       z.string().trim().min(1),
  location:   z.string().trim().min(2).max(200),
  category:   z.enum(CATEGORIES),
  price:      z.coerce.number().min(0).default(0),
  totalSeats: z.coerce.number().int().min(1).max(10000),
  tags:       z.union([z.string(), z.array(z.string())]).optional(),
  imageUrl:   z.string().url().optional().or(z.literal('')),
});

const updateEventSchema = createEventSchema.partial();

const updateEventStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

// ── Booking ───────────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  eventId: mongoId,
  seats:   z.coerce.number().int().min(1).max(10).default(1),
});

const processBookingSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  updateEventStatusSchema,
  createBookingSchema,
  processBookingSchema,
};
