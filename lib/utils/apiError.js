// lib/utils/apiError.js
// Custom error class used throughout the serverless functions.
// Carries an HTTP status code and a machine-readable error code alongside
// the human-readable message, making client-side error handling predictable.

class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status (e.g. 400, 401, 404, 500)
   * @param {string} code        Machine-readable error code (e.g. "TOKEN_EXPIRED")
   * @param {string} message     Human-readable description
   * @param {object} [details]   Optional extra data (e.g. { retryAfterSeconds: 30 })
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

module.exports = ApiError;
