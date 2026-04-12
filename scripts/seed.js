/**
 * scripts/seed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Full database seed: admin + regular users + realistic sample events.
 *
 * Usage (from project root):
 * node scripts/seed.js — idempotent upsert (safe to re-run)
 * node scripts/seed.js --clear — drop all data first, then seed
 *
 * Requires MONGO_URI in root .env (or already in environment).
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../backend/models/user');
const Event = require('../backend/models/event');
const Booking = require('../backend/models/booking');

const { MONGO_URI } = process.env;
if (!MONGO_URI) {
 console.error(' MONGO_URI not set. Copy .env.example to .env and fill it in.');
 process.exit(1);
}

const CLEAR = process.argv.includes('--clear');

// ─── Seed data ────────────────────────────────────────────────────────────────

const USERS = [
 {
 name: 'Admin',
 email: 'aryancoder999@gmail.com',
 password: '12345678',
 role: 'admin',
 isVerified: true,
 },
 {
 name: 'Satvik',
 email: 'aryansahu0004@gmail.com',
 password: '1234567890',
 role: 'user',
 isVerified: true,
 },
 {
 name: 'Dinkar',
 email: 'aryanhashcoder009@gmail.com',
 password: '123456',
 role: 'user',
 isVerified: true,
 },
];

// Future dates so events always appear as active and upcoming
const future = (daysFromNow) => {
 const d = new Date();
 d.setDate(d.getDate() + daysFromNow);
 d.setHours(0, 0, 0, 0);
 return d;
};

const EVENTS_TEMPLATE = [
 {
 title: 'TechFest 2025 — Building AI Products',
 description: 'Join industry leaders and startup founders for a full-day conference on building real-world AI products. Topics include LLMs, RAG pipelines, and deployment at scale. Includes workshops, fireside chats, and networking dinner.',
 date: future(14),
 time: '10:00 AM',
 location: 'IIT Delhi, Hauz Khas, New Delhi',
 category: 'Tech',
 price: 500,
 totalSeats: 150,
 tags: ['AI', 'machine-learning', 'startups', 'networking'],
 status: 'active',
 },
 {
 title: 'Indie Music Night — Unplugged Sessions',
 description: 'An intimate evening of live acoustic performances by emerging indie artists from across India. Featuring 8 artists across 3 hours of non-stop music. Beverages and snacks included.',
 date: future(7),
 time: '7:00 PM',
 location: 'Blue Frog, Lower Parel, Mumbai',
 category: 'Music',
 price: 0,
 totalSeats: 80,
 tags: ['live-music', 'indie', 'acoustic', 'free'],
 status: 'active',
 },
 {
 title: 'Startup Weekend Bengaluru',
 description: '54 hours. Build a startup from scratch. Teams of 3-5 people pitch ideas, form teams, and ship a working product by Sunday evening. Winners get cloud credits, mentorship, and incubation opportunities.',
 date: future(21),
 time: '6:00 PM',
 location: 'Microsoft Reactor, Bellandur, Bengaluru',
 category: 'Business',
 price: 250,
 totalSeats: 120,
 tags: ['hackathon', 'entrepreneurship', 'pitching', 'networking'],
 status: 'active',
 },
 {
 title: 'Modern Art Exhibition — Perspectives',
 description: 'Curated showcase of 45 contemporary artworks by 12 emerging Indian artists. Covers sculpture, digital art, mixed media, and photography. Opening night includes artist Q&A and guided walk.',
 date: future(10),
 time: '5:00 PM',
 location: 'NGMA, Mumbai',
 category: 'Art',
 price: 150,
 totalSeats: 200,
 tags: ['art', 'exhibition', 'contemporary', 'culture'],
 status: 'active',
 },
 {
 title: 'City Half Marathon 2025',
 description: 'The annual city half-marathon (21 km) open to all fitness levels. Certified route along the riverside, chip timing, finisher medal, and post-race nutrition. Registration includes a race kit.',
 date: future(30),
 time: '6:30 AM',
 location: 'Cubbon Park, Bengaluru',
 category: 'Sports',
 price: 350,
 totalSeats: 500,
 tags: ['running', 'marathon', 'fitness', 'outdoor'],
 status: 'active',
 },
 {
 title: 'Street Food Festival — Flavours of India',
 description: 'Three-day celebration of regional Indian street food. 60+ stalls representing cuisines from Rajasthan, Bengal, Kerala, Punjab, and more. Live cooking demos, food competitions, and family activities.',
 date: future(5),
 time: '11:00 AM',
 location: 'Hauz Khas Village, New Delhi',
 category: 'Food',
 price: 0,
 totalSeats: 1000,
 tags: ['food', 'street-food', 'festival', 'family-friendly'],
 status: 'active',
 },
 {
 title: 'Full-Stack Dev Bootcamp — Weekend Intensive',
 description: 'Two-day hands-on workshop covering React 18, Node.js, MongoDB, REST APIs, and deployment on Vercel. Suitable for developers with basic JavaScript knowledge. Includes lifetime access to recordings.',
 date: future(18),
 time: '9:00 AM',
 location: 'Online (Zoom)',
 category: 'Tech',
 price: 799,
 totalSeats: 60,
 tags: ['react', 'nodejs', 'mongodb', 'workshop', 'online'],
 status: 'active',
 },
 {
 title: 'Yoga & Mindfulness Retreat',
 description: 'A free community yoga and meditation session at sunrise. Suitable for all levels. Bring your own mat. Certified instructors guide a 90-minute session covering asanas, pranayama, and guided meditation.',
 date: future(3),
 time: '6:00 AM',
 location: 'Lodhi Garden, New Delhi',
 category: 'Other',
 price: 0,
 totalSeats: 50,
 tags: ['yoga', 'meditation', 'wellness', 'free', 'outdoor'],
 status: 'active',
 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hashPassword = (plain) => bcrypt.hash(plain, 10);

const upsertUser = async (data) => {
 const existing = await User.findOne({ email: data.email });
 if (existing) {
 // Ensure role is correct and account is verified
 existing.role = data.role;
 existing.isVerified = true;
 existing.name = data.name;
 // Only rehash if we're explicitly clearing and re-seeding
 if (CLEAR) {
 existing.password = await hashPassword(data.password);
 }
 await existing.save();
 return { user: existing, created: false };
 }

 const hashed = await hashPassword(data.password);
 const user = await User.create({ ...data, password: hashed });
 return { user, created: true };
};

const upsertEvent = async (data, adminId) => {
 const existing = await Event.findOne({ title: data.title });
 if (existing) return { event: existing, created: false };

 const event = new Event({
 ...data,
 approvalRequired: data.price > 0,
 createdBy: adminId,
 });
 await event.save(); // triggers pre-save: sets availableSeats = totalSeats
 return { event, created: true };
};

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
 try {
 await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
 console.log(' Connected to MongoDB\n');

 if (CLEAR) {
 console.log(' --clear flag detected: dropping all collections...');
 await Promise.all([
 User.deleteMany({}),
 Event.deleteMany({}),
 Booking.deleteMany({}),
 ]);
 console.log(' Collections cleared\n');
 }

 // ── Seed users ─────────────────────────────────────────────────────────────
 console.log(' Seeding users...');
 const userResults = [];
 for (const u of USERS) {
 const { user, created } = await upsertUser(u);
 userResults.push(user);
 const label = created ? ' Created' : ' Already exists (updated)';
 console.log(` ${label}: ${u.name} <${u.email}> [${u.role}]`);
 }

 const adminUser = userResults[0]; // aryancoder999 — admin
 const satvik = userResults[1];
 const dinkar = userResults[2];

 // ── Seed events ────────────────────────────────────────────────────────────
 console.log('\n Seeding events...');
 const eventResults = [];
 for (const e of EVENTS_TEMPLATE) {
 const { event, created } = await upsertEvent(e, adminUser._id);
 eventResults.push(event);
 const label = created ? ' Created' : ' Already exists (skipped)';
 console.log(` ${label}: ${e.title}`);
 }

 // ── Seed sample bookings ───────────────────────────────────────────────────
 console.log('\n Seeding sample bookings...');

 // Satvik books the free music night (auto-approved)
 const musicEvent = eventResults.find((e) => e.category === 'Music');
 // Satvik books TechFest (paid → pending)
 const techFest = eventResults.find((e) => e.title.startsWith('TechFest'));
 // Dinkar books the food festival (free → auto-approved)
 const foodFest = eventResults.find((e) => e.category === 'Food');
 // Dinkar books Startup Weekend (paid → pending)
 const startup = eventResults.find((e) => e.title.startsWith('Startup'));

 const bookingSeeds = [
 { user: satvik._id, event: musicEvent._id, seats: 2, status: 'approved', totalPrice: 0, processedAt: new Date() },
 { user: satvik._id, event: techFest._id, seats: 1, status: 'pending', totalPrice: 500 },
 { user: dinkar._id, event: foodFest._id, seats: 3, status: 'approved', totalPrice: 0, processedAt: new Date() },
 { user: dinkar._id, event: startup._id, seats: 1, status: 'pending', totalPrice: 250 },
 ];

 for (const b of bookingSeeds) {
 const exists = await Booking.findOne({ user: b.user, event: b.event, status: { $in: ['pending', 'approved'] } });
 if (exists) {
 console.log(` Booking already exists: user ${b.user} → event ${b.event}`);
 continue;
 }
 await Booking.create(b);

 // Deduct seats for approved free-event bookings
 if (b.status === 'approved') {
 await Event.findByIdAndUpdate(b.event, { $inc: { availableSeats: -b.seats } });
 }
 console.log(` Booking: ${b.status} | seats: ${b.seats} | price: Rs ${b.totalPrice}`);
 }

 // ── Summary ────────────────────────────────────────────────────────────────
 console.log('\n─────────────────────────────────────────────────────────');
 console.log(' Seed complete!\n');
 console.log(' Users:');
 console.log(` Admin → ${USERS[0].email} | password: ${USERS[0].password}`);
 console.log(` Satvik → ${USERS[1].email} | password: ${USERS[1].password}`);
 console.log(` Dinkar → ${USERS[2].email} | password: ${USERS[2].password}`);
 console.log('\n Events: 8 events created across Tech, Music, Business, Art, Sports, Food, Other');
 console.log('\n Bookings: 4 sample bookings (2 approved, 2 pending)');
 console.log('\n Change all passwords after first login in production!');
 console.log('─────────────────────────────────────────────────────────\n');

 } catch (err) {
 console.error(' Seed failed:', err.message);
 process.exit(1);
 } finally {
 await mongoose.disconnect();
 }
})();
