// api/events/getAll.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: GET /api/events/getAll
//
// Alias for the GET /api/events endpoint — included for semantic clarity.
// Using relative "/api" because backend runs on the same Vercel domain.
// This avoids CORS issues and works in production automatically.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB } = require('../../lib/db');
const Event         = require('../../lib/models/Event');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const category = req.query.category?.trim();
    const search   = req.query.search?.trim();
    const page     = Math.max(1, Number(req.query.page  || 1));
    const limit    = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

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
        .populate('createdBy', 'name')
        .sort({ date: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      events,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('[events/getAll]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
