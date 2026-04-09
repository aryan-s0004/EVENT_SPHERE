// api/bookings/my.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: GET /api/bookings/my  (authenticated users only)
//
// Returns all bookings belonging to the currently authenticated user,
// sorted by most recent first.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB } = require('../../lib/db');
const Booking       = require('../../lib/models/Booking');
const { withAuth }  = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAuth(req, res, async (req, res) => {
    try {
      const bookings = await Booking.find({ user: req.user._id })
        .populate('event', 'title date time location image price status approvalRequired')
        .sort({ createdAt: -1 });

      return res.json({ success: true, bookings: bookings || [] });
    } catch (error) {
      console.error('[bookings/my]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
