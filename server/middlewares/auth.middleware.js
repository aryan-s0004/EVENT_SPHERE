/**
 * server/middlewares/auth.middleware.js
 * JWT authentication and role-based access control middlewares.
 *
 * protect      — verifies the Bearer token and populates req.user
 * adminOnly    — ensures req.user.role === 'admin' (must come after protect)
 */
const jwt      = require('jsonwebtoken');
const User     = require('../../lib/models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'TOKEN_MISSING', 'Authentication token is required');
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    }
    throw new ApiError(401, 'TOKEN_INVALID', 'Authentication token is invalid');
  }

  // Select only the fields the app actually uses — never send password downstream
  const user = await User.findById(decoded.id).select('name email role avatar phone isVerified');
  if (!user) {
    throw new ApiError(401, 'USER_NOT_FOUND', 'User belonging to this token no longer exists');
  }

  req.user = user;
  next();
});

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'ROLE_FORBIDDEN', 'Admin access required'));
  }
  next();
};
