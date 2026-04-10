/**
 * server/middlewares/rateLimiter.middleware.js
 * Per-IP rate limiting using express-rate-limit.
 *
 * Three tiers:
 *  authLimiter   — 10 requests / 15 minutes (login, register, OTP endpoints)
 *  apiLimiter    — 100 requests / minute (general API)
 *  globalLimiter — 300 requests / minute (all routes)
 *
 * For multi-instance deployments, swap the default MemoryStore for
 * rate-limit-redis to share counts across pods.
 */
const rateLimit = require('express-rate-limit');

const jsonHandler = (req, res) =>
  res.status(429).json({
    success: false,
    code:    'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again.',
    retryAfter: res.getHeader('Retry-After'),
  });

/** Strict limiter for authentication-related endpoints */
exports.authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler:          jsonHandler,
  skipSuccessfulRequests: false,
});

/** General API limiter */
exports.apiLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         jsonHandler,
});

/** Global safety net — applied to every route */
exports.globalLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         jsonHandler,
});
