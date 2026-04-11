/**
 * server/routes/event.routes.js
 * Event and admin-event endpoints.
 *
 * Public:    GET  /             (list active events)
 *            GET  /:id          (single event)
 * Admin:     GET  /admin/all    (all events)
 *            POST /             (create)
 *            PUT  /:id          (update)
 *            DELETE /:id        (delete)
 *            PATCH /:id/status  (toggle active/inactive)
 */
'use strict';

const { Router }  = require('express');
const eventCtrl   = require('../controllers/eventController');
const { protect, adminOnly } = require('../middlewares/auth.middleware');
const { singleImage }   = require('../middlewares/upload.middleware');
const { apiLimiter }    = require('../middlewares/rateLimiter.middleware');
const validate          = require('../middlewares/validate.middleware');
const {
  createEventSchema,
  updateEventSchema,
  updateEventStatusSchema,
} = require('../validators/event.validators');

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',    apiLimiter, eventCtrl.getEvents);
router.get('/:id', apiLimiter, eventCtrl.getEvent);

// ── Admin ─────────────────────────────────────────────────────────────────────
const admin = [protect, adminOnly];

router.get   ('/admin/all',         ...admin,                                               eventCtrl.getAllEventsAdmin);
router.post  ('/',                  ...admin, singleImage, validate(createEventSchema),     eventCtrl.createEvent);
router.put   ('/:id',               ...admin, singleImage, validate(updateEventSchema),     eventCtrl.updateEvent);
router.delete('/:id',               ...admin,                                               eventCtrl.deleteEvent);
router.patch ('/admin/:id/status',  ...admin, validate(updateEventStatusSchema),            eventCtrl.updateEventStatus);

module.exports = router;
