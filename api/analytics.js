// api/analytics.js
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics  — admin-only aggregated stats
//
// Returns:
//   users    → total, verified, thisWeek
//   events   → total, active, inactive
//   bookings → total, byStatus { pending, approved, rejected, cancelled }, revenue
//   topEvents → top 5 events by approved booking count
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../lib/db');
const User              = require('../lib/models/User');
const Event             = require('../lib/models/Event');
const Booking           = require('../lib/models/Booking');
const { withAdminAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (_req, res) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Run all queries in parallel
      const [
        totalUsers,
        verifiedUsers,
        newUsersThisWeek,
        totalEvents,
        activeEvents,
        totalBookings,
        bookingsByStatus,
        revenueResult,
        topEventsRaw,
      ] = await Promise.all([
        User.countDocuments({ role: { $ne: 'admin' } }),
        User.countDocuments({ role: { $ne: 'admin' }, isVerified: true }),
        User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $gte: weekAgo } }),
        Event.countDocuments(),
        Event.countDocuments({ status: 'active' }),
        Booking.countDocuments(),

        // Bookings grouped by status
        Booking.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // Total confirmed revenue (approved bookings only)
        Booking.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } },
        ]),

        // Top 5 events by number of non-cancelled bookings
        Booking.aggregate([
          { $match: { status: { $in: ['pending', 'approved'] } } },
          { $group: { _id: '$event', bookingCount: { $sum: 1 }, seatsBooked: { $sum: '$seats' } } },
          { $sort: { bookingCount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from:         'events',
              localField:   '_id',
              foreignField: '_id',
              as:           'eventData',
            },
          },
          { $unwind: { path: '$eventData', preserveNullAndEmpty: true } },
          {
            $project: {
              _id:          1,
              bookingCount: 1,
              seatsBooked:  1,
              title:        '$eventData.title',
              category:     '$eventData.category',
              date:         '$eventData.date',
              totalSeats:   '$eventData.totalSeats',
              price:        '$eventData.price',
            },
          },
        ]),
      ]);

      // Shape booking-by-status into a flat object
      const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
      for (const { _id, count } of bookingsByStatus) {
        if (_id in byStatus) byStatus[_id] = count;
      }

      return res.json({
        success: true,
        users: {
          total:        totalUsers,
          verified:     verifiedUsers,
          newThisWeek:  newUsersThisWeek,
        },
        events: {
          total:    totalEvents,
          active:   activeEvents,
          inactive: totalEvents - activeEvents,
        },
        bookings: {
          total:    totalBookings,
          byStatus,
          revenue:  revenueResult[0]?.total || 0,
        },
        topEvents: topEventsRaw,
      });
    } catch (error) {
      console.error('[analytics]', error);
      return res.status(500).json({ success: false, message: 'Failed to load analytics' });
    }
  });
};
