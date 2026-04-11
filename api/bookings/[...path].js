// api/bookings/[...path].js
// ─────────────────────────────────────────────────────────────────────────────
// Single catch-all handler for all /api/bookings/* sub-routes.
// Vercel injects req.query.path as an array of URL segments.
//
// Routes handled:
//   GET   /api/bookings/mine                (user — own bookings)
//   PATCH /api/bookings/:id/cancel          (user — cancel booking)
//   GET   /api/bookings/admin/all           (admin — all bookings)
//   PATCH /api/bookings/admin/:id/status    (admin — approve or reject)
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../../lib/db');
const Booking           = require('../../lib/models/Booking');
const Event             = require('../../lib/models/Event');
const { withAuth, withAdminAuth } = require('../../lib/auth');
const sendEmail         = require('../../lib/utils/sendEmail');

const fireEmail = (opts) => sendEmail(opts).catch((e) => console.error('[email:booking-admin]', e.message));

const fmtDate = (date) => {
  try { return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return String(date); }
};

// ─── Sub-route handlers ───────────────────────────────────────────────────────

// GET /api/bookings/mine
async function handleMine(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAuth(req, res, async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('event', 'title date time location image price status approvalRequired')
      .sort({ createdAt: -1 });

    return res.json({ success: true, bookings: bookings || [] });
  });
}

// PATCH /api/bookings/:id/cancel
async function handleCancel(req, res, id) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAuth(req, res, async (req, res) => {
    const existing = await Booking.findById(id);
    if (!existing) return res.status(404).json({ success: false, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    if (existing.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not authorised to cancel this booking' });
    if (existing.status === 'cancelled') return res.json({ success: true, message: 'Booking was already cancelled', code: 'BOOKING_ALREADY_CANCELLED', booking: existing });
    if (existing.status === 'rejected') return res.status(400).json({ success: false, code: 'BOOKING_REJECTED', message: 'Rejected bookings cannot be cancelled' });

    const updated = await Booking.findOneAndUpdate(
      { _id: id, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'cancelled', processedAt: new Date() } },
      { new: true }
    );

    if (!updated) return res.status(409).json({ success: false, code: 'BOOKING_ALREADY_PROCESSED', message: 'Booking was already processed' });

    if (existing.status === 'approved') {
      await Event.findByIdAndUpdate(existing.event, { $inc: { availableSeats: existing.seats } });
    }

    return res.json({ success: true, message: 'Booking cancelled successfully', booking: updated });
  });
}

// GET /api/bookings/admin/all
async function handleAdminAll(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAdminAuth(req, res, async (req, res) => {
    const bookings = await Booking.find()
      .populate('user',  'name email role')
      .populate('event', 'title date availableSeats totalSeats approvalRequired')
      .sort({ createdAt: -1 });

    return res.json({ success: true, bookings: bookings.filter((b) => b.user?.role !== 'admin') });
  });
}

// PATCH /api/bookings/admin/:id/status
async function handleAdminProcess(req, res, id) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAdminAuth(req, res, async (req, res) => {
    const { status } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, code: 'INVALID_STATUS', message: 'status must be "approved" or "rejected"' });
    }

    const current = await Booking.findById(id)
      .populate('user',  'name email')
      .populate('event', 'title date time location availableSeats totalSeats status');

    if (!current) return res.status(404).json({ success: false, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });

    if (current.status !== 'pending') {
      return res.json({ success: true, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED', booking: current, event: current.event });
    }

    const eventDateStr = current.event?.date ? `${fmtDate(current.event.date)} at ${current.event.time}` : 'N/A';

    // ── Rejection ──────────────────────────────────────────────────────────────
    if (status === 'rejected') {
      const rejected = await Booking.findOneAndUpdate(
        { _id: id, status: 'pending' },
        { $set: { status: 'rejected', processedAt: new Date(), processedBy: req.user._id } },
        { new: true }
      ).populate('user', 'name email').populate('event', 'title date time location availableSeats totalSeats status');

      if (!rejected) {
        const latest = await Booking.findById(id).populate('user', 'name email').populate('event');
        return res.json({ success: true, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED', booking: latest, event: latest?.event });
      }

      if (rejected.user?.email) {
        fireEmail({ to: rejected.user.email, subject: `Booking Not Approved – ${rejected.event?.title || 'Your Event'}`, html: `<h2>Booking Not Approved</h2><p>Hi <b>${rejected.user.name}</b>, unfortunately your booking for <b>${rejected.event?.title}</b> on ${eventDateStr} could not be approved.</p>`, logLabel: 'booking-rejected' });
      }

      return res.json({ success: true, message: 'Booking rejected', booking: rejected, event: rejected.event });
    }

    // ── Approval ───────────────────────────────────────────────────────────────
    const approved = await Booking.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'approved', processedAt: new Date(), processedBy: req.user._id } },
      { new: true }
    ).populate('user', 'name email').populate('event', 'title date time location availableSeats totalSeats status');

    if (!approved) {
      const latest = await Booking.findById(id).populate('user', 'name email').populate('event');
      return res.json({ success: true, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED', booking: latest, event: latest?.event });
    }

    // Atomic seat deduction — auto-reject if event is now full
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: approved.event._id, status: 'active', availableSeats: { $gte: approved.seats } },
      { $inc: { availableSeats: -approved.seats } },
      { new: true }
    );

    if (!updatedEvent) {
      const autoRejected = await Booking.findByIdAndUpdate(
        approved._id,
        { status: 'rejected', processedAt: new Date(), processedBy: req.user._id },
        { new: true }
      ).populate('user', 'name email').populate('event');

      if (autoRejected?.user?.email) {
        fireEmail({ to: autoRejected.user.email, subject: `Booking Could Not Be Confirmed – ${autoRejected.event?.title}`, html: `<h2>Booking Could Not Be Confirmed</h2><p>Hi <b>${autoRejected.user.name}</b>, the event is now fully booked. Your booking has been auto-rejected. We apologise.</p>`, logLabel: 'booking-auto-rejected' });
      }

      return res.json({ success: true, message: 'Auto-rejected: event is now fully booked', code: 'EVENT_FULL', booking: autoRejected, event: autoRejected?.event });
    }

    const refreshed = await Booking.findById(approved._id)
      .populate('user', 'name email')
      .populate('event', 'title date time location availableSeats totalSeats status');

    if (refreshed?.user?.email) {
      fireEmail({ to: refreshed.user.email, subject: `Booking Approved! – ${refreshed.event?.title}`, html: `<h2>Booking Approved!</h2><p>Hi <b>${refreshed.user.name}</b>, your booking for <b>${refreshed.event?.title}</b> on ${eventDateStr} has been approved. We look forward to seeing you!</p>`, logLabel: 'booking-approved' });
    }

    return res.json({
      success: true,
      message: 'Booking approved',
      booking: refreshed,
      event: { id: updatedEvent._id, availableSeats: updatedEvent.availableSeats, totalSeats: updatedEvent.totalSeats, status: updatedEvent.status },
    });
  });
}

// ─── Main catch-all handler ───────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  try {
    await connectDB();

    const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);

    // /api/bookings/mine
    if (segments[0] === 'mine' && segments.length === 1) {
      return await handleMine(req, res);
    }

    // /api/bookings/admin/all
    if (segments[0] === 'admin' && segments[1] === 'all' && segments.length === 2) {
      return await handleAdminAll(req, res);
    }

    // /api/bookings/admin/:id/status
    if (segments[0] === 'admin' && segments[2] === 'status' && segments.length === 3) {
      return await handleAdminProcess(req, res, segments[1]);
    }

    // /api/bookings/:id/cancel
    if (segments[1] === 'cancel' && segments.length === 2) {
      return await handleCancel(req, res, segments[0]);
    }

    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Booking route not found' });
  } catch (error) {
    console.error('[bookings/catch-all]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
