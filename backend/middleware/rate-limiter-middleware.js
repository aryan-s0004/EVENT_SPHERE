/**
 * server/middlewares/rateLimiter.middleware.js
 * Per-IP rate limiting using express-rate-limit.
 */
const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';

const jsonHandler = (req, res) =>
  res.status(429).json({
    success: false,
    code:    'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again.',
    retryAfter: res.getHeader('Retry-After'),
  });

// Simple pass-through middleware for production if we don't have Redis
const skipInProd = (config) => {
  if (isProd) {
    return (req, res, next) => next();
  }
  return rateLimit({
    ...config,
    handler: jsonHandler,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/** Strict limiter for authentication-related endpoints */
exports.authLimiter = skipInProd({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

/** General API limiter */
exports.apiLimiter = skipInProd({
  windowMs: 60 * 1000,
  max: 100,
});

/** Global safety net — applied to every route */
exports.globalLimiter = skipInProd({
  windowMs: 60 * 1000,
  max: 300,
});

