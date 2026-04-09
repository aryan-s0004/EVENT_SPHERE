// api/auth/profile.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Routes (protected — JWT required):
//   GET /api/auth/profile  → return the authenticated user's public profile
//   PUT /api/auth/profile  → update name, phone, or avatar (multipart/form-data)
//
// This file also re-exports the same logic under /api/users/profile.js
// for cleaner URL semantics.
// ─────────────────────────────────────────────────────────────────────────────

const multer    = require('multer');
const { connectDB }   = require('../../lib/db');
const User            = require('../../lib/models/User');
const { withAuth, toPublicUser } = require('../../lib/auth');
const toDataUri       = require('../../lib/utils/fileToDataUri');

// Multer configured for in-memory storage.
// Files are converted to base64 data URIs and stored in MongoDB.
// Limit: 2 MB — larger images should be stored in an object storage service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * runMulter(req, res)
 * Runs multer as a Promise so it can be awaited in an async handler.
 * Parses `avatar` from multipart/form-data.
 */
const runMulter = (req, res) =>
  new Promise((resolve, reject) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

// ─── Serverless Handler ───────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET or PUT.' });
  }

  try {
    await connectDB();

    // Delegate to the inner handler once auth is verified.
    return withAuth(req, res, async (req, res) => {
      // ── GET /api/auth/profile ──────────────────────────────────────────────
      if (req.method === 'GET') {
        return res.json({ success: true, ...toPublicUser(req.user) });
      }

      // ── PUT /api/auth/profile ──────────────────────────────────────────────
      // Parse multipart body (supports file upload for avatar).
      try {
        await runMulter(req, res);
      } catch (multerError) {
        return res.status(400).json({ success: false, message: multerError.message });
      }

      const updates = {};

      // Only update fields that were explicitly sent.
      if (req.body?.name  !== undefined) updates.name  = String(req.body.name).trim();
      if (req.body?.phone !== undefined) updates.phone = String(req.body.phone).trim();
      if (req.file)                      updates.avatar = toDataUri(req.file);

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new:          true,
        runValidators: true,
      });

      if (!user) {
        return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
      }

      return res.json({ success: true, ...toPublicUser(user) });
    });
  } catch (error) {
    console.error('[auth/profile]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
