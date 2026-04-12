/**
 * backend/api/seed-routes.js
 * One-time database seed endpoint.
 *
 * POST /api/seed
 *   Header: x-seed-secret: <SEED_SECRET env var>
 *
 * Creates admin + 8 sample events if they don't already exist.
 * Safe to call multiple times — uses upsert logic (idempotent).
 * Remove this route (or SEED_SECRET) after first successful seed.
 */
'use strict';

const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const User       = require('../models/user');
const Event      = require('../models/event');
const asyncHandler = require('../utils/async-handler');
const ApiError     = require('../utils/api-error');

const router = Router();

// ── Guard middleware ──────────────────────────────────────────────────────────
const guardSeed = (req, _res, next) => {
  const secret = process.env.SEED_SECRET;
  if (!secret) return next(new ApiError(503, 'SEED_DISABLED', 'Seeding is not configured (SEED_SECRET not set)'));
  if (req.headers['x-seed-secret'] !== secret) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid seed secret'));
  }
  next();
};

// ── Seed data ─────────────────────────────────────────────────────────────────
const future = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
};

const EVENTS = [
  { title: 'TechFest 2026 — Building AI Products',         date: future(14), time: '10:00 AM', location: 'IIT Delhi, New Delhi',           category: 'Tech',     price: 500, totalSeats: 150, tags: ['AI', 'startups', 'networking'],        description: 'Join industry leaders for a full-day conference on building real-world AI products. Covers LLMs, RAG pipelines, and deployment.' },
  { title: 'Indie Music Night — Unplugged Sessions',        date: future(7),  time: '7:00 PM',  location: 'Blue Frog, Mumbai',              category: 'Music',    price: 0,   totalSeats: 80,  tags: ['live-music', 'indie', 'free'],         description: 'An intimate evening of live acoustic performances by emerging indie artists. Beverages and snacks included.' },
  { title: 'Startup Weekend Bengaluru',                     date: future(21), time: '6:00 PM',  location: 'Microsoft Reactor, Bengaluru',   category: 'Business', price: 250, totalSeats: 120, tags: ['hackathon', 'entrepreneurship'],        description: '54 hours. Build a startup from scratch. Teams pitch, form, and ship a working product. Winners get cloud credits and mentorship.' },
  { title: 'Modern Art Exhibition — Perspectives',          date: future(10), time: '5:00 PM',  location: 'NGMA, Mumbai',                   category: 'Art',      price: 150, totalSeats: 200, tags: ['art', 'exhibition', 'culture'],        description: 'Curated showcase of 45 contemporary artworks by 12 emerging Indian artists. Opening night includes artist Q&A and guided walk.' },
  { title: 'City Half Marathon 2026',                       date: future(30), time: '6:30 AM',  location: 'Cubbon Park, Bengaluru',         category: 'Sports',   price: 350, totalSeats: 500, tags: ['running', 'marathon', 'fitness'],      description: 'Annual city half-marathon (21 km). Certified route along the riverside, chip timing, finisher medal, and post-race nutrition.' },
  { title: 'Street Food Festival — Flavours of India',      date: future(5),  time: '11:00 AM', location: 'Hauz Khas Village, New Delhi',   category: 'Food',     price: 0,   totalSeats: 1000,tags: ['food', 'festival', 'family-friendly'], description: 'Three-day celebration of regional Indian street food. 60+ stalls, live cooking demos, food competitions, and family activities.' },
  { title: 'Full-Stack Dev Bootcamp — Weekend Intensive',   date: future(18), time: '9:00 AM',  location: 'Online (Zoom)',                  category: 'Tech',     price: 799, totalSeats: 60,  tags: ['react', 'nodejs', 'workshop'],        description: 'Hands-on workshop covering React 18, Node.js, MongoDB, REST APIs, and Vercel deployment. Lifetime access to recordings.' },
  { title: 'Yoga & Mindfulness Retreat',                    date: future(3),  time: '6:00 AM',  location: 'Lodhi Garden, New Delhi',        category: 'Other',    price: 0,   totalSeats: 50,  tags: ['yoga', 'wellness', 'free'],           description: 'Community yoga and meditation session at sunrise. Suitable for all levels. Certified instructors guide a 90-minute session.' },
];

// ── POST /api/seed ────────────────────────────────────────────────────────────
router.post('/', guardSeed, asyncHandler(async (req, res) => {
  const log = [];

  // 1. Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@eventsphere.com';
  const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const adminName  = process.env.ADMIN_NAME || 'Admin';

  let admin = await User.findOne({ email: adminEmail });
  if (admin) {
    // Sync role, verified status, and password from env vars
    admin.role       = 'admin';
    admin.isVerified = true;
    admin.password   = await bcrypt.hash(adminPass, 10);
    await admin.save({ validateModifiedOnly: true });
    log.push(`admin: synced password + role (${adminEmail})`);
  } else {
    const hashed = await bcrypt.hash(adminPass, 10);
    admin = await User.create({ name: adminName, email: adminEmail, password: hashed, role: 'admin', isVerified: true });
    log.push(`admin: created (${adminEmail})`);
  }

  // 2. Events — idempotent upsert by title
  const eventLog = [];
  for (const e of EVENTS) {
    const exists = await Event.findOne({ title: e.title });
    if (exists) {
      eventLog.push(`skip: "${e.title}"`);
      continue;
    }
    const ev = new Event({ ...e, approvalRequired: e.price > 0, createdBy: admin._id });
    await ev.save(); // pre-save sets availableSeats = totalSeats
    eventLog.push(`created: "${e.title}"`);
  }

  res.status(200).json({
    success: true,
    message: 'Seed complete',
    admin:   log,
    events:  eventLog,
  });
}));

module.exports = router;
