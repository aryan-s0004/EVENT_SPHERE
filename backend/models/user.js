// backend/models/user.js
// Mongoose schema for EventSphere users.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String },
    role:       { type: String, enum: ['user', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    avatar:     { type: String, default: '' },
    phone:      { type: String, default: '' },

    // Email verification OTP fields
    otp:           { type: String },
    otpExpiry:     { type: Date },
    otpLastSentAt: { type: Date },

    // Password-reset OTP fields
    resetOtp:             { type: String },
    resetOtpExpiry:       { type: Date },
    resetOtpLastSentAt:   { type: Date },
    resetOtpVerifiedAt:   { type: Date },
  },
  { timestamps: true }
);

// Hash password before save (only when modified).
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method for password comparison at login.
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Prevent model re-registration in serverless hot-reload environments.
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
