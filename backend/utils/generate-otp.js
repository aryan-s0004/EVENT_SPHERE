// lib/utils/generateOTP.js
// Generates a cryptographically sufficient 6-digit numeric OTP.
// Used for email verification and password reset flows.

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

module.exports = generateOTP;
