/**
 * server/controllers/authController.js
 * Thin HTTP handlers — delegate all logic to authService.
 * Controllers only handle: extracting req fields, calling service, shaping res.
 */
'use strict';

const authService  = require('../services/auth-service');
const asyncHandler = require('../utils/async-handler');

exports.register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(200).json({ success: true, message: 'OTP sent to your email', ...result });
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  const { token, user } = await authService.verifyOTP(req.body);
  res.status(200).json({ success: true, token, user });
});

exports.login = asyncHandler(async (req, res) => {
  const { token, user } = await authService.login(req.body);
  res.status(200).json({ success: true, token, user });
});

exports.googleAuth = asyncHandler(async (req, res) => {
  const { token, user } = await authService.googleAuth(req.body);
  res.status(200).json({ success: true, token, user });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.status(200).json({ success: true, message: 'Reset OTP sent to your email', ...result });
});

exports.verifyResetOTP = asyncHandler(async (req, res) => {
  const { userId } = await authService.verifyResetOTP(req.body);
  res.status(200).json({ success: true, userId });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  res.status(200).json({ success: true, message: 'Password updated successfully' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  res.status(200).json({ success: true, user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, {
    name:  req.body.name,
    phone: req.body.phone,
    file:  req.file,
  });
  res.status(200).json({ success: true, user });
});
