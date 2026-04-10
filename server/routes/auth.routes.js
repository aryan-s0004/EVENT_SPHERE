/**
 * server/routes/auth.routes.js
 * All authentication endpoints.
 *
 * Public:   POST /register, /verify-otp, /login, /google, /forgot-password,
 *                /verify-reset-otp, /reset-password
 * Protected: GET /profile, PUT /profile
 */
'use strict';

const { Router } = require('express');
const authCtrl   = require('../controllers/authController');
const { protect }  = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const { singleAvatar }  = require('../middlewares/upload.middleware');
const validate   = require('../middlewares/validate.middleware');
const {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  googleSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
} = require('../validators/auth.validators');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register',          authLimiter, validate(registerSchema),       authCtrl.register);
router.post('/verify-otp',        authLimiter, validate(verifyOtpSchema),      authCtrl.verifyOTP);
router.post('/login',             authLimiter, validate(loginSchema),          authCtrl.login);
router.post('/google',            authLimiter, validate(googleSchema),         authCtrl.googleAuth);
router.post('/forgot-password',   authLimiter, validate(forgotPasswordSchema), authCtrl.forgotPassword);
router.post('/verify-reset-otp',  authLimiter, validate(verifyResetOtpSchema), authCtrl.verifyResetOTP);
router.post('/reset-password',    authLimiter, validate(resetPasswordSchema),  authCtrl.resetPassword);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get ('/profile',   protect, authCtrl.getProfile);
router.put ('/profile',   protect, singleAvatar, authCtrl.updateProfile);

module.exports = router;
