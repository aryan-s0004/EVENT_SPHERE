// api/auth/forgot-password.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Route: POST /api/auth/forgot-password
//
// Step 1 of the password-reset flow.
// Looks up the email, generates a reset OTP, and emails it to the user.
// The OTP is valid for 10 minutes with a 1-minute resend cooldown.
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }   = require('../../lib/db');
const User            = require('../../lib/models/User');
const sendEmail       = require('../../lib/utils/sendEmail');
const generateOTP     = require('../../lib/utils/generateOTP');
const ApiError        = require('../../lib/utils/apiError');

const OTP_EXPIRY_MS          = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const cooldownSeconds = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const ms = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime());
  return Math.max(0, Math.ceil(ms / 1000));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // Return 404 explicitly so the client knows the email doesn't exist.
    if (!user) {
      return res.status(404).json({ success: false, code: 'EMAIL_NOT_FOUND', message: 'No account found with this email' });
    }

    // Enforce cooldown to prevent OTP spam.
    const wait = cooldownSeconds(user.resetOtpLastSentAt);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        code:    'OTP_RESEND_COOLDOWN',
        message: `Please wait ${wait} seconds before requesting another OTP`,
        retryAfterSeconds: wait,
      });
    }

    // Generate and persist reset OTP.
    user.resetOtp            = generateOTP();
    user.resetOtpExpiry      = new Date(Date.now() + OTP_EXPIRY_MS);
    user.resetOtpLastSentAt  = new Date();
    user.resetOtpVerifiedAt  = undefined;
    await user.save();

    let delivery;
    try {
      delivery = await sendEmail({
        to:         user.email,
        subject:    'EVENTSPHERE – Password Reset OTP',
        html:       `<h2>Password Reset OTP: <b>${user.resetOtp}</b></h2><p>Valid for 10 minutes. Do not share this code.</p>`,
        logLabel:   'reset-otp',
        debugValue: user.resetOtp,
      });
    } catch (emailError) {
      // Roll back OTP so the user can retry without waiting for cooldown.
      user.resetOtp           = undefined;
      user.resetOtpExpiry     = undefined;
      user.resetOtpLastSentAt = undefined;
      await user.save();
      throw emailError;
    }

    return res.json({
      success: true,
      message: 'Password reset OTP sent to your email',
      userId:  user._id,
      deliveryMethod:           delivery?.fallback ? 'console_fallback' : 'email',
      resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      expiresInSeconds:         OTP_EXPIRY_MS / 1000,
    });
  } catch (error) {
    console.error('[auth/forgot-password]', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }

    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
