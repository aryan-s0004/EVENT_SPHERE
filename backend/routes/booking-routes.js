/**
 * server/routes/booking.routes.js
 * Booking endpoints.
 *
 * User:  POST   /          (book event)
 *        GET    /mine      (user's own bookings)
 *        PATCH  /:id/cancel (cancel booking)
 * Admin: GET    /admin/all (all bookings)
 *        PATCH  /:id/process (approve or reject)
 */
'use strict';

const { Router }   = require('express');
const bookingCtrl  = require('../controllers/booking-controller');
const { protect, adminOnly } = require('../middleware/auth-middleware');
const { apiLimiter }  = require('../middleware/rate-limiter-middleware');
const validate        = require('../middleware/validate-middleware');
const {
  createBookingSchema,
  processBookingSchema,
} = require('../validators/event-validators');

const router = Router();
const admin  = [protect, adminOnly];

// ── User ──────────────────────────────────────────────────────────────────────
router.post  ('/',            apiLimiter, protect, validate(createBookingSchema), bookingCtrl.bookEvent);
router.get   ('/mine',        apiLimiter, protect, bookingCtrl.getUserBookings);
router.patch ('/:id/cancel',  apiLimiter, protect, bookingCtrl.cancelBooking);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get   ('/admin/all',       ...admin, bookingCtrl.getAllBookings);
router.patch ('/admin/:id/process', ...admin, validate(processBookingSchema), bookingCtrl.processBooking);

module.exports = router;
