// lib/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// Authentication helpers for Vercel serverless functions.
//
// Because serverless functions have no Express middleware chain, authentication
// is applied by wrapping each handler with `withAuth` or `withAdminAuth`.
// These wrappers verify the JWT, populate req.user, then delegate to the real
// handler function — mimicking the protect / adminOnly Express middleware.
//
// IMPORTANT: JWT_SECRET must be set as an environment variable.
// Never hard-code secrets in source files.
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const User = require('./models/User');

// ─── Token Generation ─────────────────────────────────────────────────────────

/**
 * signToken(user)
 * Creates a signed JWT containing the user's id and role.
 * Expiry is driven by the JWT_EXPIRE env var (e.g. "7d").
 */
const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

// ─── Public User Serialiser ───────────────────────────────────────────────────

/**
 * toPublicUser(user)
 * Strips sensitive fields before sending user data to the client.
 */
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar || '',
  phone: user.phone || '',
  isVerified: user.isVerified,
});

// ─── Token Extraction ─────────────────────────────────────────────────────────

/**
 * extractToken(req)
 * Reads the Bearer token from the Authorization header.
 * Cookie fallback is intentionally omitted for serverless simplicity.
 */
const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

// ─── Serverless Auth Wrappers ─────────────────────────────────────────────────

/**
 * withAuth(req, res, handler)
 * Verifies the JWT and populates req.user before calling handler(req, res).
 * Returns an error response if the token is missing, expired, or invalid.
 *
 * Usage inside a serverless function:
 *   module.exports = (req, res) => withAuth(req, res, async (req, res) => {
 *     res.json({ user: req.user });
 *   });
 */
const withAuth = async (req, res, handler) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_MISSING',
      message: 'Authentication token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    req.user = user;
    return handler(req, res);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Authentication token is invalid',
    });
  }
};

/**
 * withAdminAuth(req, res, handler)
 * Extends withAuth by also verifying that the authenticated user has the
 * 'admin' role.  Returns 403 if not.
 */
const withAdminAuth = (req, res, handler) =>
  withAuth(req, res, (req, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'ROLE_FORBIDDEN',
        message: 'Admin access is required',
      });
    }

    return handler(req, res);
  });

// ─── Method Guard ─────────────────────────────────────────────────────────────

/**
 * methodNotAllowed(res, allowed)
 * Returns a 405 response listing the HTTP methods this endpoint supports.
 * Call this in the `default` branch of your req.method switch/if chain.
 */
const methodNotAllowed = (res, allowed = []) =>
  res.setHeader('Allow', allowed.join(', ')) &&
  res.status(405).json({
    success: false,
    message: `Method not allowed. Allowed: ${allowed.join(', ')}`,
  });

module.exports = { signToken, toPublicUser, withAuth, withAdminAuth, methodNotAllowed };
