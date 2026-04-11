/**
 * server/services/eventService.js
 * Event management business logic.
 */
'use strict';

const Event    = require('../models/event');
const Booking  = require('../models/booking');
const toDataUri = require('../utils/file-to-data-uri');
const ApiError = require('../utils/api-error');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseTags = (tags) => {
  if (Array.isArray(tags))      return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// ─── Event Services ───────────────────────────────────────────────────────────

/**
 * getEvents({ category?, search?, page?, limit? })
 * Returns paginated list of active events.
 */
const getEvents = async ({ category, search, page = 1, limit = 10 }) => {
  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));

  const filter = { status: 'active' };
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { title:    { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  const [events, total] = await Promise.all([
    Event.find(filter)
      .select('title date time location category image price totalSeats availableSeats status approvalRequired tags')
      .populate('createdBy', 'name')
      .sort({ date: 1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Event.countDocuments(filter),
  ]);

  return { events, total, page: p, pages: Math.ceil(total / l) || 1 };
};

/**
 * getEvent(id)
 * Returns a single active event by ID.
 */
const getEvent = async (id) => {
  const event = await Event.findById(id)
    .populate('createdBy', 'name email')
    .lean();

  if (!event || event.status !== 'active') {
    throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  }

  return event;
};

/**
 * createEvent(payload, adminUserId)
 * Creates a new event.  Admin only.
 */
const createEvent = async (body, file, adminUserId) => {
  const price      = Number(body.price) || 0;
  const totalSeats = Number(body.totalSeats);

  const eventData = {
    title:            body.title,
    description:      body.description,
    date:             body.date,
    time:             body.time,
    location:         body.location,
    category:         body.category,
    price,
    totalSeats,
    availableSeats:   totalSeats,
    approvalRequired: price > 0,
    tags:             parseTags(body.tags),
    status:           'active',
    createdBy:        adminUserId,
  };

  if (file)           eventData.image = toDataUri(file);
  else if (body.imageUrl) eventData.image = body.imageUrl;

  return Event.create(eventData);
};

/**
 * updateEvent(id, payload, file?)
 * Updates an event.  Validates new totalSeats against approved bookings.
 */
const updateEvent = async (id, body, file) => {
  const existingEvent = await Event.findById(id);
  if (!existingEvent) throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');

  const price      = body.price      !== undefined ? Number(body.price)      : existingEvent.price;
  const totalSeats = body.totalSeats !== undefined ? Number(body.totalSeats) : existingEvent.totalSeats;

  // Guard: cannot reduce below already-approved seat count
  const [agg] = await Booking.aggregate([
    { $match: { event: existingEvent._id, status: 'approved' } },
    { $group: { _id: null, seats: { $sum: '$seats' } } },
  ]);
  const approvedSeats = agg?.seats || 0;

  if (totalSeats < approvedSeats) {
    throw ApiError.badRequest(
      `Total seats (${totalSeats}) cannot be less than already-approved bookings (${approvedSeats})`,
      'SEAT_TOTAL_TOO_LOW'
    );
  }

  const payload = {
    title:            body.title       ?? existingEvent.title,
    description:      body.description ?? existingEvent.description,
    date:             body.date        ?? existingEvent.date,
    time:             body.time        ?? existingEvent.time,
    location:         body.location    ?? existingEvent.location,
    category:         body.category    ?? existingEvent.category,
    price,
    totalSeats,
    availableSeats:   totalSeats - approvedSeats,
    approvalRequired: price > 0,
    tags:             body.tags !== undefined ? parseTags(body.tags) : existingEvent.tags,
  };

  if (file)                      payload.image = toDataUri(file);
  else if (body.imageUrl !== undefined) payload.image = body.imageUrl;

  return Event.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
};

/**
 * deleteEvent(id)
 * Deletes event and all associated bookings.
 */
const deleteEvent = async (id) => {
  const event = await Event.findById(id);
  if (!event) throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');

  await Booking.deleteMany({ event: id });
  await Event.findByIdAndDelete(id);
};

/**
 * getAllEventsAdmin()
 * Returns ALL events (active + inactive) for the admin dashboard.
 */
const getAllEventsAdmin = async () =>
  Event.find()
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

/**
 * updateEventStatus(id, status)
 * Toggles active / inactive.
 */
const updateEventStatus = async (id, status) => {
  const event = await Event.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!event) throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  return event;
};

module.exports = {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEventsAdmin,
  updateEventStatus,
};
