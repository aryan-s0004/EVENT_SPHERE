// api/users/profile.js
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: This is a Vercel serverless function.
// Routes (protected — JWT required):
//   GET /api/users/profile  → return authenticated user's public profile
//   PUT /api/users/profile  → update name, phone, or avatar
//
// This is a semantic alias for /api/auth/profile.
// Both endpoints share identical logic.
// ─────────────────────────────────────────────────────────────────────────────

// Re-export the auth/profile handler directly — no duplication needed.
module.exports = require('../auth/profile');
