// lib/models/Event.js
// Mongoose schema for EventSphere events.

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title:          { type: String, required: true, trim: true },
    description:    { type: String, required: true },
    date:           { type: Date, required: true },
    time:           { type: String, required: true },
    location:       { type: String, required: true },
    category:       { type: String, required: true },
    image:          { type: String, default: '' },   // base64 data URI or external URL
    totalSeats:     { type: Number, required: true, min: 1 },
    availableSeats: { type: Number, min: 0 },        // auto-set from totalSeats on create
    price:          { type: Number, default: 0, min: 0 },
    status:         { type: String, enum: ['active', 'inactive'], default: 'active' },
    // approvalRequired = true means bookings stay "pending" until an admin approves them.
    // Derived from price: paid events require approval, free events are auto-approved.
    approvalRequired: { type: Boolean, default: true },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags:           [String],
  },
  { timestamps: true }
);

// Auto-set availableSeats equal to totalSeats when a new event is created.
eventSchema.pre('save', function (next) {
  if (this.isNew) this.availableSeats = this.totalSeats;
  next();
});

// Index to speed up the most common query: active events sorted by date.
eventSchema.index({ status: 1, date: 1 });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
