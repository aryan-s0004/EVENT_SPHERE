/**
 * server/validators/auth.validators.js
 * Zod schemas for all authentication request bodies.
 *
 * Why Zod?
 *  - TypeScript-native but works perfectly in plain JS
 *  - Returns clean, structured error messages → no manual parsing
 *  - Lightweight (no peer deps) vs. Joi
 */
const { z } = require('zod');

const email    = z.string().trim().email('Invalid email address').toLowerCase();
const password = z.string().min(8, 'Password must be at least 8 characters');
const otp      = z.string().trim().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric');
const mongoId  = z.string().trim().length(24, 'Invalid user ID');

const registerSchema = z.object({
  name:     z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email,
  password,
});

const verifyOtpSchema = z.object({
  userId: mongoId.optional(),
  email:  email.optional(),
  otp,
}).refine((d) => d.userId || d.email, {
  message: 'Either userId or email is required',
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });


const forgotPasswordSchema = z.object({ email });

const verifyResetOtpSchema = z.object({ userId: mongoId, otp });

const resetPasswordSchema = z.object({
  userId:      mongoId,
  newPassword: password,
});

const updateProfileSchema = z.object({
  name:  z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(15).optional(),
}).partial();

module.exports = {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
};
