// api/events/admin/[id]/status.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: PATCH /api/events/admin/:id/status  (admin only)
//
// Toggles an event's status between "active" and "inactive".
// Inactive events are hidden from the public event list.
// req.query.id is injected by Vercel from the [id] directory name.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }     = require('../../../../lib/db');
const Event             = require('../../../../lib/models/Event');
const { withAdminAuth } = require('../../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await connectDB();

  return withAdminAuth(req, res, async (req, res) => {
    try {
      const { id } = req.query;
      const { status } = req.body || {};

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          code:    'INVALID_STATUS',
          message: 'status must be "active" or "inactive"',
        });
      }

      const event = await Event.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
      );

      if (!event) {
        return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Event not found' });
      }

      return res.json({ success: true, event });
    } catch (error) {
      console.error('[events/admin/[id]/status]', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
};
