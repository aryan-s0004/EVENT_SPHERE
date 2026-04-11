// api/bookings/index.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/bookings  (authenticated users only)
//
// Creates a new event booking for the authenticated user.
//
// Booking workflow:
//   Free events  (price = 0) → immediately approved; seats deducted atomically
//   Paid events  (price > 0) → status = "pending"; admin must approve
//
// Using relative "/api" because backend runs on the same Vercel domain.
// This avoids CORS issues and works in production automatically.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }  = require('../../lib/db');
const Event          = require('../../lib/models/Event');
const Booking        = require('../../lib/models/Booking');
const { withAuth }   = require('../../lib/auth');
const sendEmail      = require('../../lib/utils/sendEmail');

/** Fire-and-forget email — booking errors must not propagate to the HTTP response. */
const fireEmail = (opts) => sendEmail(opts).catch((e) => console.error('[email:booking]', e.message));

const fmtDate = (date) => {
  try {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return String(date);
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  await connectDB();

  return withAuth(req, res, async (req, res) => {
    try {
      const { eventId } = req.body || {};
      const seats = Math.max(1, Number(req.body?.seats || 1));

      if (!eventId) {
        return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'eventId is required' });
      }

      // Admins are not allowed to book events.
      if (req.user.role === 'admin') {
        return res.status(403).json({ success: false, code: 'ADMIN_BOOKING_DISABLED', message: 'Admins cannot book events' });
      }

      const event = await Event.findById(eventId);

      if (!event) {
        return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      }

      if (event.status !== 'active') {
        return res.status(400).json({ success: false, code: 'EVENT_UNAVAILABLE', message: 'This event is not available for booking' });
      }

      if (event.availableSeats < seats) {
        return res.status(409).json({ success: false, code: 'EVENT_FULL', message: 'Not enough seats available' });
      }

      // Prevent duplicate active bookings for the same event.
      const existingBooking = await Booking.findOne({
        user:   req.user._id,
        event:  eventId,
        status: { $in: ['pending', 'approved'] },
      });

      if (existingBooking) {
        return res.status(409).json({ success: false, code: 'BOOKING_EXISTS', message: 'You already have an active booking for this event' });
      }

      const requiresApproval = Number(event.price) > 0;
      const totalPrice       = event.price * seats;
      const eventDateStr     = `${fmtDate(event.date)} at ${event.time}`;

      // ── Paid event ─────────────────────────────────────────────────────────
      if (requiresApproval) {
        try {
          const booking = await Booking.create({
            user:       req.user._id,
            event:      eventId,
            seats,
            status:     'pending',
            totalPrice,
          });

          fireEmail({
            to:       req.user.email,
            subject:  `Booking Request Submitted – ${event.title}`,
            html:     `<h2>Booking Request Received</h2>
                       <p>Hi <b>${req.user.name}</b>,</p>
                       <p>Your booking request for <b>${event.title}</b> (${seats} seat(s)) on ${eventDateStr} is pending admin approval.</p>
                       <p>Total: Rs ${totalPrice}</p>
                       <p>We will notify you once it has been reviewed.</p>`,
            logLabel: 'booking-pending',
          });

          return res.status(201).json({
            success: true,
            message: 'Booking request submitted for approval',
            booking,
          });
        } catch (err) {
          if (err.code === 11000) {
            return res.status(409).json({ success: false, code: 'BOOKING_EXISTS', message: 'You already have an active booking for this event' });
          }
          throw err;
        }
      }

      // ── Free event: atomic seat deduction ──────────────────────────────────
      const updatedEvent = await Event.findOneAndUpdate(
        { _id: eventId, status: 'active', availableSeats: { $gte: seats } },
        { $inc: { availableSeats: -seats } },
        { new: true }
      );

      if (!updatedEvent) {
        return res.status(409).json({ success: false, code: 'EVENT_FULL', message: 'Not enough seats available' });
      }

      try {
        const booking = await Booking.create({
          user:        req.user._id,
          event:       eventId,
          seats,
          status:      'approved',
          totalPrice,
          processedAt: new Date(),
        });

        fireEmail({
          to:       req.user.email,
          subject:  `Booking Confirmed – ${event.title}`,
          html:     `<h2>Booking Confirmed!</h2>
                     <p>Hi <b>${req.user.name}</b>,</p>
                     <p>Your booking for <b>${event.title}</b> (${seats} seat(s)) on ${eventDateStr} is confirmed.</p>
                     <p>Free event — no payment required. See you there!</p>`,
          logLabel: 'booking-confirmed',
        });

        return res.status(201).json({
          success: true,
          message: 'Booking confirmed',
          booking,
          event: { id: updatedEvent._id, availableSeats: updatedEvent.availableSeats },
        });
      } catch (err) {
        // Roll back seat deduction so inventory stays accurate.
        await Event.findByIdAndUpdate(eventId, { $inc: { availableSeats: seats } });
        if (err.code === 11000) {
          return res.status(409).json({ success: false, code: 'BOOKING_EXISTS', message: 'You already have an active booking for this event' });
        }
        throw err;
      }
    } catch (error) {
      console.error('[bookings/index POST]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
