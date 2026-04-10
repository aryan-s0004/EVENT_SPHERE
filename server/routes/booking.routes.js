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
const bookingCtrl  = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middlewares/auth.middleware');
const { apiLimiter }  = require('../middlewares/rateLimiter.middleware');
const validate        = require('../middlewares/validate.middleware');
const {
  createBookingSchema,
  processBookingSchema,
} = require('../validators/event.validators');

const router = Router();
const admin  = [protect, adminOnly];

// ── User ──────────────────────────────────────────────────────────────────────
router.post  ('/',            apiLimiter, protect, validate(createBookingSchema), bookingCtrl.bookEvent);
router.get   ('/mine',        apiLimiter, protect, bookingCtrl.getUserBookings);
router.patch ('/:id/cancel',  apiLimiter, protect, bookingCtrl.cancelBooking);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get   ('/admin/all',       ...admin, bookingCtrl.getAllBookings);
router.patch ('/:id/process',     ...admin, validate(processBookingSchema), bookingCtrl.processBooking);

module.exports = router;
