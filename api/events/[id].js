// api/events/[id].js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// The [id] in the filename creates a dynamic route — Vercel maps it to
// /api/events/:id and injects the id via req.query.id.
//
// Routes:
//   GET    /api/events/:id  → get a single active event (public)
//   PUT    /api/events/:id  → update an event (admin only)
//   DELETE /api/events/:id  → delete an event + its bookings (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const multer   = require('multer');
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

// ─── Serverless Handler ───────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  await connectDB();

  const { id } = req.query; // injected by Vercel from the [id] filename

  // ── GET /api/events/:id ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const event = await Event.findById(id).populate('createdBy', 'name email');

      if (!event || event.status !== 'active') {
        return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      }

      return res.json({ success: true, event });
    } catch (error) {
      console.error('[events/[id] GET]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // ── PUT /api/events/:id (admin only) ─────────────────────────────────────────
  if (req.method === 'PUT') {
    return withAdminAuth(req, res, async (req, res) => {
      try {
        await runMulter(req, res);
      } catch (multerError) {
        return res.status(400).json({ success: false, message: multerError.message });
      }

      try {
        const existingEvent = await Event.findById(id);

        if (!existingEvent) {
          return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
        }

        const body        = req.body || {};
        const parsedPrice = body.price !== undefined ? Number(body.price) : existingEvent.price;
        const parsedSeats = body.totalSeats !== undefined ? Number(body.totalSeats) : existingEvent.totalSeats;

        // Ensure new totalSeats >= already approved seat count.
        const [seatSummary] = await Booking.aggregate([
          { $match: { event: existingEvent._id, status: 'approved' } },
          { $group: { _id: '$event', seats: { $sum: '$seats' } } },
        ]);

        const approvedSeats = seatSummary?.seats || 0;

        if (parsedSeats < approvedSeats) {
          return res.status(400).json({
            success: false,
            code:    'SEAT_TOTAL_TOO_LOW',
            message: `Total seats (${parsedSeats}) cannot be less than already-approved bookings (${approvedSeats})`,
          });
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

        if (req.file)          payload.image = toDataUri(req.file);
        else if (body.imageUrl !== undefined) payload.image = body.imageUrl;

        const event = await Event.findByIdAndUpdate(id, payload, { new: true, runValidators: true });

        return res.json({ success: true, event });
      } catch (error) {
        console.error('[events/[id] PUT]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });
  }

  // ── DELETE /api/events/:id (admin only) ──────────────────────────────────────
  if (req.method === 'DELETE') {
    return withAdminAuth(req, res, async (req, res) => {
      try {
        const event = await Event.findById(id);

        if (!event) {
          return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
        }

        // Remove all associated bookings before deleting the event.
        await Booking.deleteMany({ event: id });
        await Event.findByIdAndDelete(id);

        return res.json({ success: true, message: 'Event and all associated bookings deleted' });
      } catch (error) {
        console.error('[events/[id] DELETE]', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed. Use GET, PUT, or DELETE.' });
};
