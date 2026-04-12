/**
 * server/controllers/eventController.js
 * Thin HTTP handlers for event endpoints.
 */
'use strict';

const eventService = require('../services/event-service');
const asyncHandler = require('../utils/async-handler');

exports.getEvents = asyncHandler(async (req, res) => {
  try {
    const result = await eventService.getEvents(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[eventController:getEvents] Error:', err);
    throw err;
  }
});

exports.getEvent = asyncHandler(async (req, res) => {
  try {
    const event = await eventService.getEvent(req.params.id);
    res.status(200).json({ success: true, event });
  } catch (err) {
    console.error('[eventController:getEvent] Error:', err);
    throw err;
  }
});

exports.createEvent = asyncHandler(async (req, res) => {
  try {
    const event = await eventService.createEvent(req.body, req.file, req.user._id);
    res.status(201).json({ success: true, event });
  } catch (err) {
    console.error('[eventController:createEvent] Error:', err);
    throw err;
  }
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body, req.file);
  res.status(200).json({ success: true, event });
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.params.id);
  res.status(200).json({ success: true, message: 'Event deleted successfully' });
});

exports.getAllEventsAdmin = asyncHandler(async (req, res) => {
  const events = await eventService.getAllEventsAdmin();
  res.status(200).json({ success: true, events });
});

exports.updateEventStatus = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventStatus(req.params.id, req.body.status);
  res.status(200).json({ success: true, event });
});
