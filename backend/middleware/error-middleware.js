/**
 * error-middleware.js — Global Error Handler
 * --------------------------------------------
 * Every error thrown anywhere in the app ends up here.
 *
 * How it works:
 *   1. asyncHandler catches any thrown error in a controller
 *   2. Passes it to Express via next(error)
 *   3. This file's errorHandler function receives it
 *   4. Converts it to a clean JSON response
 *
 * Error types handled:
 *   - ApiError (our own)     → uses err.statusCode and err.code directly
 *   - Mongoose ValidationError → 400 with field-level messages
 *   - Mongoose CastError     → 400 "Invalid ID format"
 *   - Mongoose duplicate key → 409 "Already exists"
 *   - Everything else        → 500 "Something went wrong"
 *
 * All error responses follow this shape:
 *   { success: false, code: "MACHINE_CODE", message: "Human message" }
 */
const logger   = require('../utils/logger');
const ApiError = require('../utils/api-error');

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
  console.error("ERROR STACK:", err.stack); // Added per debug instructions
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
