// api/auth/login.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/login
//
// Authenticates a user with email + password.
// Returns a JWT token on success.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }               = require('../../lib/db');
const User                        = require('../../lib/models/User');
const { signToken, toPublicUser } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code:    'MISSING_FIELDS',
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email });

    // Use a generic message for missing user OR missing password to avoid
    // leaking whether an email address is registered (security best practice).
    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        code:    'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        code:    'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in',
      });
    }

    const passwordMatches = await user.matchPassword(password);
    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        code:    'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    return res.json({
      success: true,
      message: 'Login successful',
      token:   signToken(user),
      user:    toPublicUser(user),
    });
  } catch (error) {
    console.error('[auth/login]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
