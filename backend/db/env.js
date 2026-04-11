/**
 * server/config/env.js
 * Validates required environment variables on server start.
 * Fails fast with a clear error rather than a cryptic runtime crash later.
 *
 * Import this FIRST in server.js before anything else.
 */

const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRE'];

const OPTIONAL_WARN = [
  'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS',
  'GOOGLE_CLIENT_ID',
];

const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[env] FATAL: Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  const notConfigured = OPTIONAL_WARN.filter((key) => !process.env[key]);
  if (notConfigured.length > 0) {
    console.warn('[env] WARN: Optional env vars not set (some features will be disabled):', notConfigured.join(', '));
  }
};

module.exports = validateEnv;
