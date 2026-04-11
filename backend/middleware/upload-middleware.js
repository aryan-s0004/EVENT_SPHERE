/**
 * server/middlewares/upload.middleware.js
 * Multer instance configured for in-memory storage.
 * Instantiated ONCE at module load (not inside each handler) to avoid
 * recreating the parser on every warm invocation.
 *
 * Limits:
 *  - Max file size: 2 MB
 *  - Allowed MIME types: image/* only
 */
const multer = require('multer');
const ApiError = require('../utils/api-error');

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only image files are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits:     { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter,
});

/** Single image upload middleware — use as route middleware */
exports.singleImage = upload.single('image');

/** Single avatar upload middleware */
exports.singleAvatar = upload.single('avatar');
