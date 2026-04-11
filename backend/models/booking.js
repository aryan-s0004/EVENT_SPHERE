// lib/models/Booking.js
// Mongoose schema for EventSphere bookings.

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    event:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    seats:       { type: Number, required: true, default: 1, min: 1 },
    status:      {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    totalPrice:  { type: Number, default: 0 },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Prevent a user from booking the same event twice while a booking is active.
// The partial filter means the unique constraint is only enforced for
// pending/approved bookings — cancelled and rejected ones are ignored.
bookingSchema.index(
  { user: 1, event: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'approved'] } },
  }
);

// Secondary index for the admin "all bookings" query (sorted by newest first).
bookingSchema.index({ event: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
