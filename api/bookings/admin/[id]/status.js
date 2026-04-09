// api/bookings/admin/[id]/status.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: PATCH /api/bookings/admin/:id/status  (admin only)
//
// Approves or rejects a pending booking.
//   approve → deducts seats from event atomically; sends approval email
//   reject  → booking stays at 0 seat impact; sends rejection email
//
// req.query.id is injected by Vercel from the [id] directory name.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../../../../lib/db');
const Booking           = require('../../../../lib/models/Booking');
const Event             = require('../../../../lib/models/Event');
const { withAdminAuth } = require('../../../../lib/auth');
const sendEmail         = require('../../../../lib/utils/sendEmail');

const fireEmail = (opts) => sendEmail(opts).catch((e) => console.error('[email:booking-admin]', e.message));

const fmtDate = (date) => {
  try { return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return String(date); }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (req, res) => {
    try {
      const { id }     = req.query;
      const { status } = req.body || {};

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          code:    'INVALID_STATUS',
          message: 'status must be "approved" or "rejected"',
        });
      }

      // Fetch with populated fields for the response and email.
      const currentBooking = await Booking.findById(id)
        .populate('user',  'name email')
        .populate('event', 'title date time location availableSeats totalSeats status');

      if (!currentBooking) {
        return res.status(404).json({ success: false, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
      }

      // Idempotent: if already processed, return the current state.
      if (currentBooking.status !== 'pending') {
        return res.json({
          success: true,
          message: 'Booking already processed',
          code:    'BOOKING_ALREADY_PROCESSED',
          booking: currentBooking,
          event:   currentBooking.event,
        });
      }

      const eventDateStr = currentBooking.event?.date
        ? `${fmtDate(currentBooking.event.date)} at ${currentBooking.event.time}`
        : 'N/A';

      // ── Rejection path ─────────────────────────────────────────────────────
      if (status === 'rejected') {
        const rejected = await Booking.findOneAndUpdate(
          { _id: id, status: 'pending' },
          { $set: { status: 'rejected', processedAt: new Date(), processedBy: req.user._id } },
          { new: true }
        )
          .populate('user',  'name email')
          .populate('event', 'title date time location availableSeats totalSeats status');

        if (!rejected) {
          // Race condition — someone else processed it; return current state.
          const latest = await Booking.findById(id)
            .populate('user',  'name email')
            .populate('event', 'title date time location availableSeats totalSeats status');

          return res.json({ success: true, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED', booking: latest, event: latest?.event });
        }

        if (rejected.user?.email) {
          fireEmail({
            to:       rejected.user.email,
            subject:  `Booking Not Approved – ${rejected.event?.title || 'Your Event'}`,
            html:     `<h2>Booking Not Approved</h2><p>Hi <b>${rejected.user.name}</b>, unfortunately your booking for <b>${rejected.event?.title}</b> on ${eventDateStr} could not be approved. Please check our other available events.</p>`,
            logLabel: 'booking-rejected',
          });
        }

        return res.json({ success: true, message: 'Booking rejected', booking: rejected, event: rejected.event });
      }

      // ── Approval path ──────────────────────────────────────────────────────
      const approved = await Booking.findOneAndUpdate(
        { _id: id, status: 'pending' },
        { $set: { status: 'approved', processedAt: new Date(), processedBy: req.user._id } },
        { new: true }
      )
        .populate('user',  'name email')
        .populate('event', 'title date time location availableSeats totalSeats status');

      if (!approved) {
        const latest = await Booking.findById(id)
          .populate('user',  'name email')
          .populate('event', 'title date time location availableSeats totalSeats status');

        return res.json({ success: true, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED', booking: latest, event: latest?.event });
      }

      // Atomically deduct seats — auto-reject if the event is now full.
      const updatedEvent = await Event.findOneAndUpdate(
        { _id: approved.event._id, status: 'active', availableSeats: { $gte: approved.seats } },
        { $inc: { availableSeats: -approved.seats } },
        { new: true }
      );

      if (!updatedEvent) {
        // Event is full — auto-reject this booking.
        const autoRejected = await Booking.findByIdAndUpdate(
          approved._id,
          { status: 'rejected', processedAt: new Date(), processedBy: req.user._id },
          { new: true }
        )
          .populate('user',  'name email')
          .populate('event', 'title date time location availableSeats totalSeats status');

        if (autoRejected?.user?.email) {
          fireEmail({
            to:       autoRejected.user.email,
            subject:  `Booking Could Not Be Confirmed – ${autoRejected.event?.title || 'Your Event'}`,
            html:     `<h2>Booking Could Not Be Confirmed</h2><p>Hi <b>${autoRejected.user.name}</b>, the event <b>${autoRejected.event?.title}</b> is now fully booked. Your booking has been auto-rejected. We apologise for the inconvenience.</p>`,
            logLabel: 'booking-auto-rejected',
          });
        }

        return res.json({
          success: true,
          message: 'Booking auto-rejected: event is now fully booked',
          code:    'EVENT_FULL',
          booking: autoRejected,
          event:   autoRejected?.event,
        });
      }

      // Refresh booking for accurate populated response.
      const refreshed = await Booking.findById(approved._id)
        .populate('user',  'name email')
        .populate('event', 'title date time location availableSeats totalSeats status');

      if (refreshed?.user?.email) {
        fireEmail({
          to:       refreshed.user.email,
          subject:  `Booking Approved! – ${refreshed.event?.title || 'Your Event'}`,
          html:     `<h2>Booking Approved!</h2><p>Hi <b>${refreshed.user.name}</b>, your booking for <b>${refreshed.event?.title}</b> on ${eventDateStr} has been approved. We look forward to seeing you!</p>`,
          logLabel: 'booking-approved',
        });
      }

      return res.json({
        success: true,
        message: 'Booking approved',
        booking: refreshed,
        event: {
          id:             updatedEvent._id,
          availableSeats: updatedEvent.availableSeats,
          totalSeats:     updatedEvent.totalSeats,
          status:         updatedEvent.status,
        },
      });
    } catch (error) {
      console.error('[bookings/admin/[id]/status]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
