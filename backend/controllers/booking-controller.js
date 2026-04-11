/**
 * server/controllers/bookingController.js
 * Thin HTTP handlers for booking endpoints.
 */
'use strict';

const bookingService = require('../services/booking-service');
const asyncHandler   = require('../utils/async-handler');

exports.bookEvent = asyncHandler(async (req, res) => {
  const result = await bookingService.bookEvent(req.body, req.user);
  res.status(201).json({ success: true, ...result });
});

exports.getUserBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getUserBookings(req.user._id);
  res.status(200).json({ success: true, bookings });
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.cancelBooking(req.params.id, req.user._id);
  res.status(200).json({ success: true, ...result });
});

exports.getAllBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getAllBookings();
  res.status(200).json({ success: true, bookings });
});

exports.processBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.processBooking(req.params.id, req.body.status, req.user._id);
  res.status(200).json({ success: true, ...result });
});
