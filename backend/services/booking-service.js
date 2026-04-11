/**
 * server/services/bookingService.js
 * Booking management business logic.
 *
 * Key design decisions:
 *  - Seat deduction uses findOneAndUpdate with $gte guard (atomic — prevents overselling)
 *  - Emails are fire-and-forget (failure never aborts the booking)
 *  - Duplicate booking prevented by MongoDB partial unique index
 */
'use strict';

const Booking   = require('../models/booking');
const Event     = require('../models/event');
const sendEmail = require('../utils/send-email');
const ApiError  = require('../utils/api-error');

// ─── Email helpers ────────────────────────────────────────────────────────────

const fireEmail = (opts) =>
  sendEmail(opts).catch((e) => console.error('[email:booking]', e.message));

const fmtDate = (date) => {
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day:   'numeric',
      month: 'long',
      year:  'numeric',
    });
  } catch {
    return String(date);
  }
};

const buildEmailHtml = ({ heading, name, eventTitle, eventDate, seats, totalPrice, statusLine, accent = '#16a34a' }) =>
  `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#111827;padding:16px 20px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:1rem;letter-spacing:3px">EVENTSPHERE</h1>
    </div>
    <div style="padding:28px 24px;background:#fff">
      <h2 style="margin:0 0 8px;color:#111827">${heading}</h2>
      <p style="color:#6b7280">Hi <strong style="color:#111827">${name}</strong>,</p>
      <div style="background:#f9fafb;border-left:4px solid ${accent};border-radius:6px;padding:16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Event:</strong> ${eventTitle}</p>
        <p style="margin:0 0 6px"><strong>Date:</strong> ${eventDate}</p>
        <p style="margin:0 0 6px"><strong>Seats:</strong> ${seats}</p>
        <p style="margin:0"><strong>Total:</strong> ${totalPrice > 0 ? `Rs ${totalPrice}` : 'Free'}</p>
      </div>
      <p style="color:#374151">${statusLine}</p>
    </div>
  </div>`;

// ─── Booking Services ─────────────────────────────────────────────────────────

/**
 * bookEvent({ eventId, seats }, user)
 */
const bookEvent = async ({ eventId, seats }, user) => {
  if (user.role === 'admin') {
    throw ApiError.forbidden('Admins cannot book events', 'ADMIN_BOOKING_DISABLED');
  }

  const event = await Event.findById(eventId);
  if (!event)                       throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  if (event.status !== 'active')    throw ApiError.badRequest('Event is not available', 'EVENT_UNAVAILABLE');
  if (event.availableSeats < seats) throw ApiError.conflict('Not enough seats available', 'EVENT_FULL');

  const existing = await Booking.findOne({
    user:   user._id,
    event:  eventId,
    status: { $in: ['pending', 'approved'] },
  });
  if (existing) throw ApiError.conflict('You already have an active booking for this event', 'BOOKING_EXISTS');

  const totalPrice       = event.price * seats;
  const requiresApproval = event.price > 0;
  const eventDateStr     = `${fmtDate(event.date)} at ${event.time}`;

  // ── Paid event: create pending booking (no seat deduction yet) ────────────
  if (requiresApproval) {
    try {
      const booking = await Booking.create({
        user: user._id, event: eventId, seats, status: 'pending', totalPrice,
      });

      fireEmail({
        to:         user.email,
        subject:    `Booking Request Submitted – ${event.title}`,
        html:       buildEmailHtml({
          heading:    'Booking Request Received',
          name:       user.name,
          eventTitle: event.title,
          eventDate:  eventDateStr,
          seats,
          totalPrice,
          statusLine: 'Your request is <strong>pending admin approval</strong>. We will notify you once reviewed.',
          accent:     '#d97706',
        }),
        logLabel:   'booking-pending',
      });

      return { booking, message: 'Booking request submitted for approval' };
    } catch (err) {
      if (err.code === 11000) throw ApiError.conflict('You already have an active booking', 'BOOKING_EXISTS');
      throw err;
    }
  }

  // ── Free event: atomic seat deduction then create approved booking ─────────
  const updatedEvent = await Event.findOneAndUpdate(
    { _id: eventId, status: 'active', availableSeats: { $gte: seats } },
    { $inc: { availableSeats: -seats } },
    { new: true }
  );
  if (!updatedEvent) throw ApiError.conflict('Not enough seats available', 'EVENT_FULL');

  try {
    const booking = await Booking.create({
      user: user._id, event: eventId, seats, status: 'approved', totalPrice, processedAt: new Date(),
    });

    fireEmail({
      to:         user.email,
      subject:    `Booking Confirmed – ${event.title}`,
      html:       buildEmailHtml({
        heading:    'Booking Confirmed!',
        name:       user.name,
        eventTitle: event.title,
        eventDate:  eventDateStr,
        seats,
        totalPrice,
        statusLine: 'Your booking is <strong>confirmed</strong>. See you there!',
      }),
      logLabel: 'booking-confirmed',
    });

    return {
      booking,
      event:   { id: updatedEvent._id, availableSeats: updatedEvent.availableSeats },
      message: 'Booking confirmed',
    };
  } catch (err) {
    await Event.findByIdAndUpdate(eventId, { $inc: { availableSeats: seats } });
    if (err.code === 11000) throw ApiError.conflict('You already have an active booking', 'BOOKING_EXISTS');
    throw err;
  }
};

/**
 * getUserBookings(userId)
 */
const getUserBookings = async (userId) =>
  Booking.find({ user: userId })
    .populate('event', 'title date time location image price status approvalRequired')
    .sort({ createdAt: -1 })
    .lean();

/**
 * cancelBooking(bookingId, userId)
 */
const cancelBooking = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found', 'BOOKING_NOT_FOUND');
  if (booking.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Not authorised to cancel this booking');
  }
  if (booking.status === 'cancelled') {
    return { booking, message: 'Booking was already cancelled', code: 'BOOKING_ALREADY_CANCELLED' };
  }
  if (booking.status === 'rejected') {
    throw ApiError.badRequest('Rejected bookings cannot be cancelled', 'BOOKING_REJECTED');
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'cancelled', processedAt: new Date() } },
    { new: true }
  );

  if (!updated) throw ApiError.conflict('Booking was already processed', 'BOOKING_ALREADY_PROCESSED');

  if (booking.status === 'approved') {
    await Event.findByIdAndUpdate(booking.event, { $inc: { availableSeats: booking.seats } });
  }

  return { booking: updated, message: 'Booking cancelled successfully' };
};

/**
 * getAllBookings() — admin view
 */
const getAllBookings = async () => {
  const bookings = await Booking.find()
    .populate('user',  'name email role')
    .populate('event', 'title date availableSeats totalSeats approvalRequired')
    .sort({ createdAt: -1 })
    .lean();

  return bookings.filter((b) => b.user?.role !== 'admin');
};

/**
 * processBooking(bookingId, status, adminUserId) — approve or reject
 */
const processBooking = async (bookingId, status, adminUserId) => {
  const current = await Booking.findById(bookingId)
    .populate('user',  'name email')
    .populate('event', 'title date time location availableSeats totalSeats status');

  if (!current) throw ApiError.notFound('Booking not found', 'BOOKING_NOT_FOUND');

  if (current.status !== 'pending') {
    return { booking: current, event: current.event, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED' };
  }

  const eventDateStr = current.event?.date
    ? `${fmtDate(current.event.date)} at ${current.event.time}`
    : 'N/A';

  // ── Rejection ──────────────────────────────────────────────────────────────
  if (status === 'rejected') {
    const rejected = await Booking.findOneAndUpdate(
      { _id: bookingId, status: 'pending' },
      { $set: { status: 'rejected', processedAt: new Date(), processedBy: adminUserId } },
      { new: true }
    )
      .populate('user', 'name email')
      .populate('event', 'title date time location availableSeats totalSeats status');

    if (!rejected) {
      const latest = await Booking.findById(bookingId).populate('user', 'name email').populate('event');
      return { booking: latest, event: latest?.event, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED' };
    }

    if (rejected.user?.email) {
      fireEmail({
        to:         rejected.user.email,
        subject:    `Booking Not Approved – ${rejected.event?.title}`,
        html:       buildEmailHtml({
          heading:    'Booking Not Approved',
          name:       rejected.user.name,
          eventTitle: rejected.event?.title || 'N/A',
          eventDate:  eventDateStr,
          seats:      rejected.seats,
          totalPrice: rejected.totalPrice,
          statusLine: "We're sorry, your booking could not be approved at this time.",
          accent:     '#dc2626',
        }),
        logLabel: 'booking-rejected',
      });
    }

    return { booking: rejected, event: rejected.event, message: 'Booking rejected' };
  }

  // ── Approval ───────────────────────────────────────────────────────────────
  const approved = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'pending' },
    { $set: { status: 'approved', processedAt: new Date(), processedBy: adminUserId } },
    { new: true }
  )
    .populate('user', 'name email')
    .populate('event', 'title date time location availableSeats totalSeats status');

  if (!approved) {
    const latest = await Booking.findById(bookingId).populate('user', 'name email').populate('event');
    return { booking: latest, event: latest?.event, message: 'Booking already processed', code: 'BOOKING_ALREADY_PROCESSED' };
  }

  // Atomic seat deduction — auto-reject if event is now full
  const updatedEvent = await Event.findOneAndUpdate(
    { _id: approved.event._id, status: 'active', availableSeats: { $gte: approved.seats } },
    { $inc: { availableSeats: -approved.seats } },
    { new: true }
  );

  if (!updatedEvent) {
    // Event became full during approval window — auto-reject
    const autoRejected = await Booking.findByIdAndUpdate(
      approved._id,
      { status: 'rejected', processedAt: new Date(), processedBy: adminUserId },
      { new: true }
    ).populate('user', 'name email').populate('event');

    if (autoRejected?.user?.email) {
      fireEmail({
        to: autoRejected.user.email,
        subject: `Booking Could Not Be Confirmed – ${autoRejected.event?.title}`,
        html: buildEmailHtml({
          heading: 'Booking Could Not Be Confirmed',
          name: autoRejected.user.name,
          eventTitle: autoRejected.event?.title || 'N/A',
          eventDate: eventDateStr,
          seats: autoRejected.seats,
          totalPrice: autoRejected.totalPrice,
          statusLine: 'The event is now fully booked. Your booking has been auto-rejected. We apologise.',
          accent: '#dc2626',
        }),
        logLabel: 'booking-auto-rejected',
      });
    }

    return { booking: autoRejected, event: autoRejected?.event, message: 'Auto-rejected: event is now fully booked', code: 'EVENT_FULL' };
  }

  const refreshed = await Booking.findById(approved._id)
    .populate('user', 'name email')
    .populate('event', 'title date time location availableSeats totalSeats status');

  if (refreshed?.user?.email) {
    fireEmail({
      to: refreshed.user.email,
      subject: `Booking Approved! – ${refreshed.event?.title}`,
      html: buildEmailHtml({
        heading: 'Booking Approved!',
        name: refreshed.user.name,
        eventTitle: refreshed.event?.title || 'N/A',
        eventDate: eventDateStr,
        seats: refreshed.seats,
        totalPrice: refreshed.totalPrice,
        statusLine: 'Your booking is <strong>approved</strong>. We look forward to seeing you!',
      }),
      logLabel: 'booking-approved',
    });
  }

  return {
    booking: refreshed,
    event:   { id: updatedEvent._id, availableSeats: updatedEvent.availableSeats, totalSeats: updatedEvent.totalSeats, status: updatedEvent.status },
    message: 'Booking approved',
  };
};

module.exports = {
  bookEvent,
  getUserBookings,
  cancelBooking,
  getAllBookings,
  processBooking,
};
