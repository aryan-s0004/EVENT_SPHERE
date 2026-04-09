// api/auth/reset-password.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/reset-password
//
// Step 3 (final) of the password-reset flow.
// Requires that /api/auth/verify-reset-otp was completed first (OTP verified).
// Updates the password and clears all reset OTP fields.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB } = require('../../lib/db');
const User          = require('../../lib/models/User');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { userId, newPassword } = req.body || {};

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        code:    'MISSING_FIELDS',
        message: 'userId and newPassword are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        code:    'PASSWORD_TOO_SHORT',
        message: 'Password must be at least 8 characters',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    // Guard: OTP must still be within its validity window.
    if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) {
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP session expired. Please restart the password reset flow.' });
    }

    // Guard: verify-reset-otp must have been completed before this step.
    if (!user.resetOtpVerifiedAt) {
      return res.status(403).json({
        success: false,
        code:    'OTP_NOT_VERIFIED',
        message: 'Please verify your OTP before resetting the password',
      });
    }

    // Set new password (hashing handled by the User pre-save hook).
    user.password            = newPassword;
    user.isVerified          = true;
    user.resetOtp            = undefined;
    user.resetOtpExpiry      = undefined;
    user.resetOtpLastSentAt  = undefined;
    user.resetOtpVerifiedAt  = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    console.error('[auth/reset-password]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
