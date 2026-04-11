// api/events/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles the root /api/events route (zero sub-segments):
//   GET  /api/events          — public paginated event listing
//   POST /api/events          — admin: create a new event
//
// WHY THIS FILE EXISTS:
//   Vercel's [...path] catch-all pattern requires at least one captured segment
//   and does NOT match zero-segment paths like /api/events.  Without this file
//   Vercel returns 404 for the events listing and event creation endpoints.
//   The catch-all handler (./[...path].js) already contains the logic for
//   segments.length === 0 — we simply delegate to it here.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = require('./[...path].js');
