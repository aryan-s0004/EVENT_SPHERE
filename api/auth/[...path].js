// api/auth/[...path].js
// ─────────────────────────────────────────────────────────────────────────────
// Single catch-all handler for ALL /api/auth/* routes.
// Vercel injects req.query.path as an array of URL segments after /api/auth/.
//
// Routes handled:
//   POST /api/auth/register
//   POST /api/auth/verify-otp
//   POST /api/auth/login
//   POST /api/auth/google
//   POST /api/auth/forgot-password
//   POST /api/auth/verify-reset-otp
//   POST /api/auth/reset-password
//   GET  /api/auth/profile        (protected)
//   PUT  /api/auth/profile        (protected)
// ─────────────────────────────────────────────────────────────────────────────

const multer  = require('multer');
const { OAuth2Client }            = require('google-auth-library');
const { connectDB }               = require('../../lib/db');
const User                        = require('../../lib/models/User');
const { signToken, toPublicUser, withAuth } = require('../../lib/auth');
const sendEmail                   = require('../../lib/utils/sendEmail');
const generateOTP                 = require('../../lib/utils/generateOTP');
const toDataUri                   = require('../../lib/utils/fileToDataUri');

const OTP_EXPIRY_MS          = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const runMulter = (req, res) =>
  new Promise((resolve, reject) =>
    upload.single('avatar')(req, res, (err) => (err ? reject(err) : resolve()))
  );

const cooldownSeconds = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const ms = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime());
  return Math.max(0, Math.ceil(ms / 1000));
};

// ─── Sub-route handlers ───────────────────────────────────────────────────────

async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Name, email, and password are required' });
  }

  let user = await User.findOne({ email });
  const isNew = !user;
  const prevOtp = user ? { otp: user.otp, otpExpiry: user.otpExpiry, otpLastSentAt: user.otpLastSentAt } : null;

  if (user?.isVerified) return res.status(409).json({ success: false, code: 'EMAIL_IN_USE', message: 'An account with this email already exists' });
  if (user?.googleId && !user.password) return res.status(409).json({ success: false, code: 'GOOGLE_ACCOUNT_EXISTS', message: 'This email is registered with Google login' });

  const wait = cooldownSeconds(user?.otpLastSentAt);
  if (wait > 0) return res.status(429).json({ success: false, code: 'OTP_RESEND_COOLDOWN', message: `Please wait ${wait} seconds before requesting another OTP`, retryAfterSeconds: wait });

  if (user) { user.name = name; user.password = password; }
  else user = new User({ name, email, password, isVerified: false });

  user.otp           = generateOTP();
  user.otpExpiry     = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpLastSentAt = new Date();
  await user.save();

  let delivery;
  try {
    delivery = await sendEmail({ to: email, subject: 'EVENTSPHERE – Verify Your Email', html: `<h2>Your OTP: <b>${user.otp}</b></h2><p>Valid for 10 minutes. Do not share this code.</p>`, logLabel: 'verify-otp', debugValue: user.otp });
  } catch (emailError) {
    if (isNew) await User.findByIdAndDelete(user._id);
    else if (prevOtp) { Object.assign(user, prevOtp); await user.save(); }
    throw emailError;
  }

  return res.status(200).json({ success: true, message: 'OTP sent to your email', userId: user._id, deliveryMethod: delivery?.fallback ? 'console_fallback' : 'email', resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000, expiresInSeconds: OTP_EXPIRY_MS / 1000 });
}

async function handleVerifyOtp(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { userId, email, otp } = req.body || {};
  if (!otp) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'OTP is required' });

  const user = userId ? await User.findById(userId) : await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });

  if (user.isVerified) return res.json({ success: true, message: 'Email already verified', token: signToken(user), user: toPublicUser(user) });
  if (!user.otp || user.otp !== otp) return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid OTP' });
  if (!user.otpExpiry || Date.now() > new Date(user.otpExpiry).getTime()) return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' });

  user.isVerified = true; user.otp = undefined; user.otpExpiry = undefined; user.otpLastSentAt = undefined;
  await user.save();

  return res.json({ success: true, message: 'Email verified successfully', token: signToken(user), user: toPublicUser(user) });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Email and password are required' });

  const user = await User.findOne({ email });
  if (!user || !user.password) return res.status(400).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  if (!user.isVerified) return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in' });

  const match = await user.matchPassword(password);
  if (!match) return res.status(400).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });

  return res.json({ success: true, message: 'Login successful', token: signToken(user), user: toPublicUser(user) });
}

async function handleGoogle(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  if (!googleClient) return res.status(503).json({ success: false, code: 'GOOGLE_NOT_CONFIGURED', message: 'Google OAuth is not configured' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Google ID token is required' });

  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({ name, email, googleId, avatar: picture || '', isVerified: true, role: 'user' });
    } else {
      if (!user.googleId) {
        if (!user.isVerified) return res.status(403).json({ success: false, code: 'VERIFY_EMAIL_FIRST', message: 'Please verify your email before linking a Google account' });
        user.googleId = googleId;
      }
      user.avatar = picture || user.avatar; user.isVerified = true;
      await user.save();
    }

    return res.json({ success: true, message: 'Google login successful', token: signToken(user), user: toPublicUser(user) });
  } catch (err) {
    // google-auth-library throws various error shapes — catch all of them here
    // rather than letting them bubble up to the generic 500 handler.
    const msg = err.message || '';
    const isTokenError =
      msg.toLowerCase().includes('token') ||
      msg.toLowerCase().includes('aud') ||
      msg.toLowerCase().includes('audience') ||
      msg.toLowerCase().includes('expired') ||
      msg.toLowerCase().includes('invalid') ||
      msg.toLowerCase().includes('jwt') ||
      err.name === 'TokenError';

    if (isTokenError) {
      return res.status(401).json({
        success: false,
        code:    'GOOGLE_TOKEN_INVALID',
        message: 'Google sign-in failed — please try again. If the problem persists, refresh the page.',
      });
    }
    throw err;
  }
}

async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'Email is required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, code: 'EMAIL_NOT_FOUND', message: 'No account found with this email' });

  const wait = cooldownSeconds(user.resetOtpLastSentAt);
  if (wait > 0) return res.status(429).json({ success: false, code: 'OTP_RESEND_COOLDOWN', message: `Please wait ${wait} seconds`, retryAfterSeconds: wait });

  user.resetOtp = generateOTP(); user.resetOtpExpiry = new Date(Date.now() + OTP_EXPIRY_MS); user.resetOtpLastSentAt = new Date(); user.resetOtpVerifiedAt = undefined;
  await user.save();

  let delivery;
  try {
    delivery = await sendEmail({ to: user.email, subject: 'EVENTSPHERE – Password Reset OTP', html: `<h2>Reset OTP: <b>${user.resetOtp}</b></h2><p>Valid for 10 minutes. Do not share this code.</p>`, logLabel: 'reset-otp', debugValue: user.resetOtp });
  } catch (emailError) {
    user.resetOtp = user.resetOtpExpiry = user.resetOtpLastSentAt = undefined;
    await user.save(); throw emailError;
  }

  return res.json({ success: true, message: 'Password reset OTP sent', userId: user._id, deliveryMethod: delivery?.fallback ? 'console_fallback' : 'email', resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000, expiresInSeconds: OTP_EXPIRY_MS / 1000 });
}

async function handleVerifyResetOtp(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { userId, otp } = req.body || {};
  if (!userId || !otp) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'userId and otp are required' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
  if (!user.resetOtp || user.resetOtp !== otp) return res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Invalid OTP' });
  if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP has expired' });

  user.resetOtpVerifiedAt = new Date(); await user.save();
  return res.json({ success: true, message: 'OTP verified. You may now reset your password.', userId: user._id });
}

async function handleResetPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'userId and newPassword are required' });
  if (newPassword.length < 8) return res.status(400).json({ success: false, code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
  if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'OTP session expired. Please restart the reset flow.' });
  if (!user.resetOtpVerifiedAt) return res.status(403).json({ success: false, code: 'OTP_NOT_VERIFIED', message: 'Please verify your OTP before resetting the password' });

  user.password = newPassword; user.isVerified = true;
  user.resetOtp = user.resetOtpExpiry = user.resetOtpLastSentAt = user.resetOtpVerifiedAt = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password reset successful. Please log in with your new password.' });
}

async function handleProfile(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ success: false, message: 'Method not allowed. Use GET or PUT.' });

  return withAuth(req, res, async (req, res) => {
    if (req.method === 'GET') return res.json({ success: true, user: toPublicUser(req.user) });

    try { await runMulter(req, res); }
    catch (multerError) { return res.status(400).json({ success: false, message: multerError.message }); }

    const updates = {};
    if (req.body?.name  !== undefined) updates.name  = String(req.body.name).trim();
    if (req.body?.phone !== undefined) updates.phone = String(req.body.phone).trim();
    if (req.file) updates.avatar = toDataUri(req.file);

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });

    return res.json({ success: true, user: toPublicUser(user) });
  });
}

// ─── Main catch-all handler ───────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  try {
    await connectDB();

    // Extract route from req.url directly — req.query.path is unreliable in
    // some Vercel CLI deployment modes.  req.url is always populated.
    const urlPath  = (req.url || '').split('?')[0];           // strip query string
    const afterAuth = urlPath.replace(/^\/api\/auth\/?/, ''); // strip /api/auth/
    // Fallback to req.query.path if url-based extraction yields nothing
    const segments = req.query.path || [];
    const route    = afterAuth || (Array.isArray(segments) ? segments.join('/') : String(segments));

    switch (route) {
      case 'register':          return await handleRegister(req, res);
      case 'verify-otp':        return await handleVerifyOtp(req, res);
      case 'login':             return await handleLogin(req, res);
      case 'google':            return await handleGoogle(req, res);
      case 'forgot-password':   return await handleForgotPassword(req, res);
      case 'verify-reset-otp':  return await handleVerifyResetOtp(req, res);
      case 'reset-password':    return await handleResetPassword(req, res);
      case 'profile':           return await handleProfile(req, res);
      default:
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Auth route '${route}' not found` });
    }
  } catch (error) {
    console.error('[auth/catch-all]', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
