// api/health.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: GET /api/health
//
// Health-check endpoint — use this to verify the API is alive after deployment.
// Returns database connection status so you can diagnose connectivity issues
// without checking server logs.
//
// NOTE: No PORT is used because Vercel automatically handles serverless
// execution — there is no persistent server process to bind a port.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB, getDatabaseHealth } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Attempt DB connection so the health check reflects true connectivity.
    await connectDB();

    const db = getDatabaseHealth();

    return res.status(200).json({
      success:     true,
      status:      'OK',
      message:     'EventSphere API is running',
      timestamp:   new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      database: {
        connected:       db.ready,
        lastConnectedAt: db.lastConnectedAt,
        lastError:       db.lastError || null,
      },
    });
  } catch (error) {
    console.error('[health]', error);

    return res.status(503).json({
      success:   false,
      status:    'ERROR',
      message:   'API is running but database connection failed',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error:     error.message,
      },
    });
  }
};
