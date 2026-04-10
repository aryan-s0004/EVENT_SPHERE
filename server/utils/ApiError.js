/**
 * server/utils/ApiError.js
 * Operational (expected) errors that the global error handler serialises to
 * JSON responses.  Thrown by services and controllers, caught by the
 * errorHandler middleware so no endpoint needs its own try/catch for
 * predictable failure cases.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code
   * @param {string} code        Machine-readable error code  (e.g. "TOKEN_EXPIRED")
   * @param {string} message     Human-readable description
   * @param {object} [details]   Optional extra payload attached to the response
   */
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name       = 'ApiError';
    this.statusCode = statusCode;
    this.code       = code;
    this.details    = details;
    this.isOperational = true; // flag used by the error handler
  }

  static badRequest(message, code = 'BAD_REQUEST')     { return new ApiError(400, code, message); }
  static unauthorized(message, code = 'UNAUTHORIZED')  { return new ApiError(401, code, message); }
  static forbidden(message, code = 'FORBIDDEN')        { return new ApiError(403, code, message); }
  static notFound(message, code = 'NOT_FOUND')         { return new ApiError(404, code, message); }
  static conflict(message, code = 'CONFLICT')          { return new ApiError(409, code, message); }
  static tooMany(message, code = 'RATE_LIMITED')       { return new ApiError(429, code, message); }
  static internal(message = 'Internal server error')   { return new ApiError(500, 'INTERNAL_ERROR', message); }
}

module.exports = ApiError;
