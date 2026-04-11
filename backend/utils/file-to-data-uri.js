// lib/utils/fileToDataUri.js
// Converts a multer in-memory file buffer into a base64 data URI string.
// The data URI is stored directly in MongoDB so no separate file storage
// service is required (suitable for small images ≤ 2 MB).

/**
 * @param {object} file  Multer file object ({ buffer, mimetype })
 * @returns {string}     data URI string, or '' on failure
 */
const toDataUri = (file) => {
  if (!file?.buffer || !file.mimetype) return '';
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

module.exports = toDataUri;
