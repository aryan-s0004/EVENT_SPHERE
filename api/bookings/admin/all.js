// api/bookings/admin/all.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: GET /api/bookings/admin/all  (admin only)
//
// Returns all bookings in the system (for admin dashboard), excluding any
// bookings made by admin accounts themselves.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../../../lib/db');
const Booking           = require('../../../lib/models/Booking');
const { withAdminAuth } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (req, res) => {
    try {
      const bookings = await Booking.find()
        .populate('user',  'name email role')
        .populate('event', 'title date availableSeats totalSeats approvalRequired')
        .sort({ createdAt: -1 });

      // Filter out bookings created by admins (should not exist, but guard anyway).
      const userBookings = (bookings || []).filter((b) => b.user?.role !== 'admin');

      return res.json({ success: true, bookings: userBookings });
    } catch (error) {
      console.error('[bookings/admin/all]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
