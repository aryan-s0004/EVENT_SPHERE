/**
 * server/utils/asyncHandler.js
 * Wraps an async Express route handler and forwards any thrown error to next().
 * Eliminates the repetitive try/catch boilerplate in every controller.
 *
 * Usage:
 *   exports.login = asyncHandler(async (req, res) => {
 *     const result = await authService.login(req.body);
 *     res.json({ success: true, ...result });
 *   });
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
