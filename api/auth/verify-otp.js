// api/auth/verify-otp.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/verify-otp
//
// Verifies the 6-digit OTP sent during registration.
// On success: marks user as verified and returns a JWT so the user is
// immediately logged in — no separate login step required.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }          = require('../../lib/db');
const User                   = require('../../lib/models/User');
const { signToken, toPublicUser } = require('../../lib/auth');
const ApiError               = require('../../lib/utils/apiError');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { userId, email, otp } = req.body || {};

    if (!otp) {
      return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'OTP is required' });
    }

    // Accept either userId or email to look up the user.
    const user = userId
      ? await User.findById(userId)
      : await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    // If already verified, return a token so the client can proceed.
    if (user.isVerified) {
      return res.json({
        success: true,
        message: 'Email already verified',
        token:   signToken(user),
        user:    toPublicUser(user),
      });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid OTP' });
    }

    if (!user.otpExpiry || Date.now() > new Date(user.otpExpiry).getTime()) {
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' });
    }

    // Mark as verified and clear OTP fields.
    user.isVerified    = true;
    user.otp           = undefined;
    user.otpExpiry     = undefined;
    user.otpLastSentAt = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully',
      token:   signToken(user),
      user:    toPublicUser(user),
    });
  } catch (error) {
    console.error('[auth/verify-otp]', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
