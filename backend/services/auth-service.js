/**
 * auth-service.js — Authentication business logic.
 * Controllers call these functions and return the result.
 */
'use strict';

const jwt            = require('jsonwebtoken');
const User           = require('../models/user');
const sendEmail      = require('../utils/send-email');
const generateOTP    = require('../utils/generate-otp');
const toDataUri      = require('../utils/file-to-data-uri');
const ApiError       = require('../utils/api-error');

const OTP_EXPIRY_MS          = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;       // 1 minute


// ─── Helpers ──────────────────────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

const toPublicUser = (user) => ({
  id:         user._id,
  name:       user.name,
  email:      user.email,
  role:       user.role,
  avatar:     user.avatar || '',
  phone:      user.phone  || '',
  isVerified: user.isVerified,
});

const cooldownSeconds = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const remaining = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime());
  return Math.max(0, Math.ceil(remaining / 1000));
};

// ─── Auth Services ────────────────────────────────────────────────────────────

/**
 * register({ name, email, password })
 * Creates or updates an unverified user and sends a 6-digit OTP.
 */
const register = async ({ name, email, password }) => {
  let user = await User.findOne({ email });
  if (user?.isVerified) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
  }

  const isNew = !user;
  const previousOtpState = user
    ? { otp: user.otp, otpExpiry: user.otpExpiry, otpLastSentAt: user.otpLastSentAt }
    : null;

  const wait = cooldownSeconds(user?.otpLastSentAt);
  if (wait > 0) {
    throw new ApiError(429, 'OTP_RESEND_COOLDOWN',
      `Please wait ${wait} seconds before requesting another OTP`,
      { retryAfterSeconds: wait }
    );
  }

  if (user) {
    user.name     = name;
    user.password = password;
  } else {
    user = new User({ name, email, password, isVerified: false });
  }

  user.otp           = generateOTP();
  user.otpExpiry     = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpLastSentAt = new Date();
  await user.save();


  let delivery;
  try {
    delivery = await sendEmail({
      to:         email,
      subject:    'EVENTSPHERE – Verify Your Email',
      html:       `<h2>Your OTP: <b>${user.otp}</b></h2><p>Valid for 10 minutes. Do not share this code.</p>`,
      logLabel:   'verify-otp',
      debugValue: user.otp,
    });
  } catch (emailError) {
    // Roll back so user can retry immediately
    if (isNew) {
      await User.findByIdAndDelete(user._id);
    } else if (previousOtpState) {
      Object.assign(user, previousOtpState);
      await user.save();
    }
    throw emailError;
  }

  return {
    userId:                   user._id,
    deliveryMethod:           delivery?.fallback ? 'console_fallback' : 'email',
    resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    expiresInSeconds:         OTP_EXPIRY_MS / 1000,
  };
};

/**
 * verifyOTP({ userId?, email?, otp })
 * Marks the user as verified and returns a JWT.
 */
const verifyOTP = async ({ userId, email, otp }) => {
  const user = userId
    ? await User.findById(userId)
    : await User.findOne({ email });
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

  if (user.isVerified) {
    return { token: signToken(user), user: toPublicUser(user) };
  }

  if (!user.otp || user.otp !== otp) {
    throw ApiError.badRequest('Invalid OTP', 'OTP_INVALID');
  }
  if (!user.otpExpiry || Date.now() > new Date(user.otpExpiry).getTime()) {
    throw ApiError.badRequest('OTP has expired. Please request a new one.', 'OTP_EXPIRED');
  }

  user.isVerified    = true;
  user.otp           = undefined;
  user.otpExpiry     = undefined;
  user.otpLastSentAt = undefined;
  await user.save();

  return { token: signToken(user), user: toPublicUser(user) };
};

/**
 * login({ email, password })
 * Validates credentials and returns a JWT.
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.password) {
    throw ApiError.badRequest('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
  }

  const match = await user.matchPassword(password);
  if (!match) {
    throw ApiError.badRequest('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return { token: signToken(user), user: toPublicUser(user) };
};


/**
 * forgotPassword({ email })
 * Sends a password-reset OTP.
 */
const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw ApiError.notFound('No account found with this email', 'EMAIL_NOT_FOUND');

  const wait = cooldownSeconds(user.resetOtpLastSentAt);
  if (wait > 0) {
    throw new ApiError(429, 'OTP_RESEND_COOLDOWN',
      `Please wait ${wait} seconds before requesting another OTP`,
      { retryAfterSeconds: wait }
    );
  }

  user.resetOtp           = generateOTP();
  user.resetOtpExpiry     = new Date(Date.now() + OTP_EXPIRY_MS);
  user.resetOtpLastSentAt = new Date();
  user.resetOtpVerifiedAt = undefined;
  await user.save();


  let delivery;
  try {
    delivery = await sendEmail({
      to:         user.email,
      subject:    'EVENTSPHERE – Password Reset OTP',
      html:       `<h2>Reset OTP: <b>${user.resetOtp}</b></h2><p>Valid for 10 minutes. Do not share this code.</p>`,
      logLabel:   'reset-otp',
      debugValue: user.resetOtp,
    });
  } catch (emailError) {
    user.resetOtp = user.resetOtpExpiry = user.resetOtpLastSentAt = undefined;
    await user.save();
    throw emailError;
  }

  return {
    userId:                   user._id,
    deliveryMethod:           delivery?.fallback ? 'console_fallback' : 'email',
    resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    expiresInSeconds:         OTP_EXPIRY_MS / 1000,
  };
};

/**
 * verifyResetOTP({ userId, otp })
 * Validates the reset OTP and marks it as verified.
 */
const verifyResetOTP = async ({ userId, otp }) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

  if (!user.resetOtp || user.resetOtp !== otp) {
    throw ApiError.badRequest('Invalid OTP', 'OTP_INVALID');
  }

  if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) {
    throw ApiError.badRequest('OTP has expired. Please restart the password reset flow.', 'OTP_EXPIRED');
  }

  user.resetOtpVerifiedAt = new Date();
  await user.save();

  return { userId: user._id };
};

/**
 * resetPassword({ userId, newPassword })
 * Updates the password after OTP verification.
 */
const resetPassword = async ({ userId, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

  if (!user.resetOtpExpiry || Date.now() > new Date(user.resetOtpExpiry).getTime()) {
    throw ApiError.badRequest('OTP session expired. Please restart the reset flow.', 'OTP_EXPIRED');
  }

  if (!user.resetOtpVerifiedAt) {
    throw new ApiError(403, 'OTP_NOT_VERIFIED', 'Please verify your OTP before resetting the password');
  }

  user.password            = newPassword;
  user.isVerified          = true;
  user.resetOtp            = undefined;
  user.resetOtpExpiry      = undefined;
  user.resetOtpLastSentAt  = undefined;
  user.resetOtpVerifiedAt  = undefined;
  await user.save();
};

/**
 * getProfile(userId)
 * Returns the public profile of a user.
 */
const getProfile = async (userId) => {
  const user = await User.findById(userId).select('name email role avatar phone isVerified');
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  return toPublicUser(user);
};

/**
 * updateProfile(userId, { name?, phone?, file? })
 * Updates allowed profile fields.
 */
const updateProfile = async (userId, { name, phone, file }) => {
  const updates = {};
  if (name  !== undefined) updates.name  = name;
  if (phone !== undefined) updates.phone = phone;
  if (file)                updates.avatar = toDataUri(file);

  const user = await User.findByIdAndUpdate(userId, updates, {
    new:           true,
    runValidators: true,
    select:        'name email role avatar phone isVerified',
  });

  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  return toPublicUser(user);
};

module.exports = {
  register,
  verifyOTP,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getProfile,
  updateProfile,
};
