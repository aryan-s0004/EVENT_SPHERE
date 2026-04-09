// api/auth/register.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Each file in /api acts as an independent API endpoint.
// No app.listen() is required — Vercel manages the HTTP server automatically.
//
// Routes handled:
//   POST /api/auth/register    → create account, send OTP email
//   POST /api/auth/verify-otp  → is handled by api/auth/verify-otp.js
// ─────────────────────────────────────────────────────────────────────────────

const { connectDB }   = require('../../lib/db');
const User            = require('../../lib/models/User');
const sendEmail       = require('../../lib/utils/sendEmail');
const generateOTP     = require('../../lib/utils/generateOTP');
const ApiError        = require('../../lib/utils/apiError');

const OTP_EXPIRY_MS          = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;       // 1 minute

/**
 * Returns how many seconds remain in the OTP resend cooldown.
 * Returns 0 when the cooldown has elapsed.
 */
const cooldownSeconds = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const ms = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime());
  return Math.max(0, Math.ceil(ms / 1000));
};

// ─── Serverless Handler ───────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // Only POST is accepted on this endpoint.
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Ensure DB is connected before any Mongoose operations.
    await connectDB();

    const { name, email, password } = req.body || {};

    // Validate required fields.
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Name, email, and password are required',
      });
    }

    // Look for an existing user with this email.
    let user = await User.findOne({ email });
    const isNewUser = !user;

    // Snapshot previous OTP state so we can restore it if the email send fails.
    const previousOtpState = user
      ? { otp: user.otp, otpExpiry: user.otpExpiry, otpLastSentAt: user.otpLastSentAt }
      : null;

    if (user?.isVerified) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists',
      });
    }

    if (user?.googleId && !user.password) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message: 'This email is already registered with Google login',
      });
    }

    // Enforce resend cooldown to prevent OTP spam.
    const wait = cooldownSeconds(user?.otpLastSentAt);
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        code: 'OTP_RESEND_COOLDOWN',
        message: `Please wait ${wait} seconds before requesting another OTP`,
        retryAfterSeconds: wait,
      });
    }

    if (user) {
      // Update existing unverified user's details.
      user.name     = name;
      user.password = password;
    } else {
      user = new User({ name, email, password, isVerified: false });
    }

    // Generate OTP and set expiry.
    user.otp           = generateOTP();
    user.otpExpiry     = new Date(Date.now() + OTP_EXPIRY_MS);
    user.otpLastSentAt = new Date();
    await user.save();

    // Send OTP via email.  On failure: roll back OTP changes to allow retry.
    let delivery;
    try {
      delivery = await sendEmail({
        to:         email,
        subject:    'EVENTSPHERE – Verify Your Email',
        html:       `<h2>Your OTP: <b>${user.otp}</b></h2><p>Valid for 10 minutes.</p>`,
        logLabel:   'verify-otp',
        debugValue: user.otp,
      });
    } catch (emailError) {
      // Roll back OTP changes so the user can retry immediately.
      if (isNewUser) {
        await User.findByIdAndDelete(user._id);
      } else if (previousOtpState) {
        Object.assign(user, previousOtpState);
        await user.save();
      }
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
      userId:                user._id,
      deliveryMethod:        delivery?.fallback ? 'console_fallback' : 'email',
      resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
      expiresInSeconds:      OTP_EXPIRY_MS / 1000,
    });
  } catch (error) {
    console.error('[auth/register]', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        code:    error.code,
        message: error.message,
        ...(error.details || {}),
      });
    }

    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
