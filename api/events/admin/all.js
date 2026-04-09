// api/events/admin/all.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: GET /api/events/admin/all  (admin only)
//
// Returns ALL events regardless of status (active and inactive).
// The public /api/events endpoint only returns active events.
//
// NOTE: Vercel resolves static path segments before dynamic ones, so
// /api/events/admin/all is matched here, not by /api/events/[id].js.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../../../lib/db');
const Event             = require('../../../lib/models/Event');
const { withAdminAuth } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (req, res) => {
    try {
      const events = await Event.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

      return res.json({ success: true, events });
    } catch (error) {
      console.error('[events/admin/all]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
