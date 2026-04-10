/**
 * server/middlewares/validate.middleware.js
 * Factory middleware that validates req.body against a Zod schema.
 * Strips unknown fields (stripping prevents param pollution).
 * Attaches the parsed, coerced data back to req.body.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), authController.login);
 */
const ApiError = require('../utils/ApiError');

const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);

  if (!result.success) {
    // Flatten Zod errors into a readable object: { field: "message" }
    const errors = result.error.flatten().fieldErrors;
    const firstMessage = Object.values(errors).flat()[0] || 'Validation failed';
    return next(new ApiError(400, 'VALIDATION_ERROR', firstMessage, errors));
  }

  req[target] = result.data; // replace with parsed/coerced data
  next();
};

module.exports = validate;
