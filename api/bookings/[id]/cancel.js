// api/bookings/[id]/cancel.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: PATCH /api/bookings/:id/cancel  (authenticated users only)
//
// Cancels a booking owned by the authenticated user.
// Seats are restored to the event only if the booking was approved.
// req.query.id is injected by Vercel from the [id] directory name.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB } = require('../../../lib/db');
const Booking       = require('../../../lib/models/Booking');
const Event         = require('../../../lib/models/Event');
const { withAuth }  = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAuth(req, res, async (req, res) => {
    try {
      const { id } = req.query;

      const existingBooking = await Booking.findById(id);

      if (!existingBooking) {
        return res.status(404).json({ success: false, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
      }

      // Users can only cancel their own bookings.
      if (existingBooking.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not authorized to cancel this booking' });
      }

      if (existingBooking.status === 'cancelled') {
        return res.json({
          success: true,
          message: 'Booking was already cancelled',
          code:    'BOOKING_ALREADY_CANCELLED',
          booking: existingBooking,
        });
      }

      if (existingBooking.status === 'rejected') {
        return res.status(400).json({ success: false, code: 'BOOKING_REJECTED', message: 'Rejected bookings cannot be cancelled' });
      }

      // Atomically flip to cancelled only if still pending/approved.
      const updatedBooking = await Booking.findOneAndUpdate(
        { _id: id, status: { $in: ['pending', 'approved'] } },
        { $set: { status: 'cancelled', processedAt: new Date() } },
        { new: true }
      );

      if (!updatedBooking) {
        return res.status(409).json({ success: false, code: 'BOOKING_ALREADY_PROCESSED', message: 'Booking was already processed' });
      }

      // Restore seats only for previously approved bookings.
      if (existingBooking.status === 'approved') {
        await Event.findByIdAndUpdate(existingBooking.event, {
          $inc: { availableSeats: existingBooking.seats },
        });
      }

      return res.json({ success: true, message: 'Booking cancelled successfully', booking: updatedBooking });
    } catch (error) {
      console.error('[bookings/[id]/cancel]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
