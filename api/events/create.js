// api/events/create.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/events/create  (admin only)
//
// Dedicated event-creation endpoint.
// The same logic is also available via POST /api/events (index.js).
// This file exists as a named alternative that is easier to call from
// admin tooling or scripts.
//
// Using relative "/api" because backend runs on the same Vercel domain.
// This avoids CORS issues and works in production automatically.
// ─────────────────────────────────────────────────────────────────────────────

const multer    = require('multer');
const { connectDB }     = require('../../lib/db');
const Event             = require('../../lib/models/Event');
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (req, res) => {
    try {
      await runMulter(req, res);
    } catch (multerError) {
      return res.status(400).json({ success: false, message: multerError.message });
    }

    try {
      const { title, description, date, time, location, category, price, totalSeats, tags, imageUrl } = req.body || {};

      if (!title || !description || !date || !time || !location || !category || !totalSeats) {
        return res.status(400).json({
          success: false,
          code:    'MISSING_FIELDS',
          message: 'title, description, date, time, location, category, and totalSeats are required',
        });
      }

      const parsedPrice = Number(price) || 0;
      const parsedSeats = Number(totalSeats);

      const eventData = {
        title, description, date, time, location, category,
        price:            parsedPrice,
        totalSeats:       parsedSeats,
        availableSeats:   parsedSeats,
        approvalRequired: parsedPrice > 0,
        tags:             parseTags(tags),
        status:           'active',
        createdBy:        req.user._id,
      };

      if (req.file)       eventData.image = toDataUri(req.file);
      else if (imageUrl)  eventData.image = imageUrl;

      const event = await Event.create(eventData);

      return res.status(201).json({ success: true, event });
    } catch (error) {
      console.error('[events/create]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
