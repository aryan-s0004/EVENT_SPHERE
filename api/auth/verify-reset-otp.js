// api/auth/verify-reset-otp.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/verify-reset-otp
//
// Step 2 of the password-reset flow.
// Validates the reset OTP and marks it as verified so the user can proceed
// to /api/auth/reset-password.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB } = require('../../lib/db');
const User          = require('../../lib/models/User');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { userId, otp } = req.body || {};

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        code:    'MISSING_FIELDS',
        message: 'userId and otp are required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid OTP' });
    }

    if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) {
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' });
    }

    // Mark OTP as verified — checked again in /reset-password.
    user.resetOtpVerifiedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      message: 'OTP verified. You may now reset your password.',
      userId:  user._id,
    });
  } catch (error) {
    console.error('[auth/verify-reset-otp]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
