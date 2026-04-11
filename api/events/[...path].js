// api/events/[...path].js
// ─────────────────────────────────────────────────────────────────────────────
// Single catch-all handler for all /api/events/* sub-routes.
// Vercel injects req.query.path as an array of URL segments.
//
// Routes handled:
//   GET    /api/events/:id                  (public)
//   PUT    /api/events/:id                  (admin)
//   DELETE /api/events/:id                  (admin)
//   GET    /api/events/admin/all            (admin)
//   PATCH  /api/events/admin/:id/status     (admin)
// ─────────────────────────────────────────────────────────────────────────────

const multer  = require('multer');
const { connectDB }     = require('../../lib/db');
const Event             = require('../../lib/models/Event');
const Booking           = require('../../lib/models/Booking');
const { withAdminAuth } = require('../../lib/auth');
const toDataUri         = require('../../lib/utils/fileToDataUri');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const runMulter = (req, res) =>
  new Promise((resolve, reject) =>
    upload.single('image')(req, res, (err) => (err ? reject(err) : resolve()))
  );

const parseTags = (tags) => {
  if (Array.isArray(tags))      return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

// ─── Sub-route handlers ───────────────────────────────────────────────────────

// GET|PUT|DELETE /api/events/:id
async function handleEventById(req, res, id) {
  // GET — public
  if (req.method === 'GET') {
    try {
      const event = await Event.findById(id).populate('createdBy', 'name email');
      if (!event || event.status !== 'active') return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      return res.json({ success: true, event });
    } catch (e) {
      if (e.name === 'CastError') return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      throw e;
    }
  }

  // PUT — admin
  if (req.method === 'PUT') {
    return withAdminAuth(req, res, async (req, res) => {
      try { await runMulter(req, res); }
      catch (multerError) { return res.status(400).json({ success: false, message: multerError.message }); }

      const existingEvent = await Event.findById(id);
      if (!existingEvent) return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });

      const body        = req.body || {};
      const parsedPrice = body.price      !== undefined ? Number(body.price)      : existingEvent.price;
      const parsedSeats = body.totalSeats !== undefined ? Number(body.totalSeats) : existingEvent.totalSeats;

      const [seatSummary] = await Booking.aggregate([
        { $match: { event: existingEvent._id, status: 'approved' } },
        { $group: { _id: '$event', seats: { $sum: '$seats' } } },
      ]);
      const approvedSeats = seatSummary?.seats || 0;

      if (parsedSeats < approvedSeats) {
        return res.status(400).json({ success: false, code: 'SEAT_TOTAL_TOO_LOW', message: `Total seats (${parsedSeats}) cannot be less than already-approved bookings (${approvedSeats})` });
      }

      const payload = {
        title:            body.title       ?? existingEvent.title,
        description:      body.description ?? existingEvent.description,
        date:             body.date        ?? existingEvent.date,
        time:             body.time        ?? existingEvent.time,
        location:         body.location    ?? existingEvent.location,
        category:         body.category    ?? existingEvent.category,
        price:            parsedPrice,
        totalSeats:       parsedSeats,
        availableSeats:   parsedSeats - approvedSeats,
        approvalRequired: parsedPrice > 0,
        tags:             body.tags !== undefined ? parseTags(body.tags) : existingEvent.tags,
      };

      if (req.file) payload.image = toDataUri(req.file);
      else if (body.imageUrl !== undefined) payload.image = body.imageUrl;

      const event = await Event.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
      return res.json({ success: true, event });
    });
  }

  // DELETE — admin
  if (req.method === 'DELETE') {
    return withAdminAuth(req, res, async (req, res) => {
      const event = await Event.findById(id);
      if (!event) return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });

      await Booking.deleteMany({ event: id });
      await Event.findByIdAndDelete(id);

      return res.json({ success: true, message: 'Event and all associated bookings deleted' });
    });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed. Use GET, PUT, or DELETE.' });
}

// GET /api/events/admin/all
async function handleAdminAll(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAdminAuth(req, res, async (req, res) => {
    const events = await Event.find().populate('createdBy', 'name').sort({ createdAt: -1 });
    return res.json({ success: true, events });
  });
}

// PATCH /api/events/admin/:id/status
async function handleAdminStatus(req, res, id) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method not allowed' });

  return withAdminAuth(req, res, async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, code: 'INVALID_STATUS', message: 'status must be "active" or "inactive"' });
    }

    const event = await Event.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });

    return res.json({ success: true, event });
  });
}

// ─── Main catch-all handler ───────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  try {
    await connectDB();

    // Extract path segments from req.url directly — req.query.path is unreliable
    // in some Vercel CLI deployment modes.
    const urlPath      = (req.url || '').split('?')[0];
    const afterEvents  = urlPath.replace(/^\/api\/events\/?/, '');
    const fromUrl      = afterEvents ? afterEvents.split('/') : [];
    const fromQuery    = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const segments     = fromUrl.length ? fromUrl : fromQuery;

    // /api/events  (GET list, POST create) — previously in index.js
    if (segments.length === 0) {
      if (req.method === 'GET') {
        const category = req.query.category?.trim();
        const search   = req.query.search?.trim();
        const page     = Math.max(1, Number(req.query.page  || 1));
        const limit    = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
        const filter   = { status: 'active' };
        if (category) filter.category = category;
        if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { location: { $regex: search, $options: 'i' } }];
        const [events, total] = await Promise.all([
          Event.find(filter).populate('createdBy', 'name').sort({ date: 1 }).skip((page - 1) * limit).limit(limit),
          Event.countDocuments(filter),
        ]);
        return res.json({ success: true, events, total, page, pages: Math.ceil(total / limit) || 1 });
      }
      if (req.method === 'POST') {
        return withAdminAuth(req, res, async (req, res) => {
          try { await runMulter(req, res); } catch (e) { return res.status(400).json({ success: false, message: e.message }); }
          const { title, description, date, time, location, category, price, totalSeats, tags, imageUrl } = req.body || {};
          if (!title || !description || !date || !time || !location || !category || !totalSeats) {
            return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'title, description, date, time, location, category, and totalSeats are required' });
          }
          const parsedPrice = Number(price) || 0;
          const parsedSeats = Number(totalSeats);
          const eventData = { title, description, date, time, location, category, price: parsedPrice, totalSeats: parsedSeats, availableSeats: parsedSeats, approvalRequired: parsedPrice > 0, tags: parseTags(tags), status: 'active', createdBy: req.user._id };
          if (req.file) eventData.image = toDataUri(req.file);
          else if (imageUrl) eventData.image = imageUrl;
          const event = await Event.create(eventData);
          return res.status(201).json({ success: true, event });
        });
      }
      return res.status(405).json({ success: false, message: 'Method not allowed. Use GET or POST.' });
    }

    // /api/events/admin/all
    if (segments[0] === 'admin' && segments[1] === 'all' && segments.length === 2) {
      return await handleAdminAll(req, res);
    }

    // /api/events/admin/:id/status
    if (segments[0] === 'admin' && segments[2] === 'status' && segments.length === 3) {
      return await handleAdminStatus(req, res, segments[1]);
    }

    // /api/events/:id
    if (segments.length === 1) {
      return await handleEventById(req, res, segments[0]);
    }

    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Event route not found' });
  } catch (error) {
    console.error('[events/catch-all]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
