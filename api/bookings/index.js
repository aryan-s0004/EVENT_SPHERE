// api/bookings/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles the root /api/bookings route (zero sub-segments):
//   POST /api/bookings         — authenticated user: create a booking
//
// WHY THIS FILE EXISTS:
//   Vercel's [...path] catch-all pattern requires at least one captured segment
//   and does NOT match zero-segment paths like /api/bookings.  Without this file
//   Vercel returns 404 for the booking creation endpoint.
//   The catch-all handler (./[...path].js) already contains the logic for
//   segments.length === 0 — we simply delegate to it here.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = require('./[...path].js');
