/**
 * server/middlewares/error.middleware.js
 * Global Express error handler — must be registered LAST (4-argument signature).
 *
 * All errors, whether thrown manually (new ApiError) or propagated by
 * asyncHandler, end up here.  Operational errors get a structured JSON
 * response.  Programmer errors (bugs) get logged and return a generic 500.
 */
const logger   = require('../utils/logger');
const ApiError = require('../utils/ApiError');

// 404 — catches requests that matched no route
const notFound = (req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};

// Global error handler
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      code:    'VALIDATION_ERROR',
      message: messages[0] || 'Validation failed',
      errors:  messages,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      code:    'DUPLICATE_KEY',
      message: `A record with this ${field} already exists`,
    });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code:    'INVALID_ID',
      message: 'Invalid resource ID format',
    });
  }

  // Our own operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code:    err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Programmer / unexpected errors — log full stack, hide details from client
  logger.error('Unhandled error', {
    err:    err.message,
    stack:  err.stack,
    method: req.method,
    path:   req.originalUrl,
  });

  return res.status(500).json({
    success: false,
    code:    'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'
      : err.message,
  });
};

module.exports = { notFound, errorHandler };
