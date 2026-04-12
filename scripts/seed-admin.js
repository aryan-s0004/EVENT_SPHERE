/**
 * scripts/seed-admin.js
 * One-time script to create the first admin account.
 *
 * Usage:
 * node scripts/seed-admin.js
 *
 * Requires .env (or environment variables) with MONGO_URI set.
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../lib/models/User');

const {
 MONGO_URI,
 ADMIN_NAME = 'Admin',
 ADMIN_EMAIL = 'admin@eventsphere.com',
 ADMIN_PASSWORD = 'Admin@1234',
} = process.env;

if (!MONGO_URI) {
 console.error(' MONGO_URI is not set. Copy .env.example to .env and fill in the value.');
 process.exit(1);
}

(async () => {
 try {
 await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
 console.log(' Connected to MongoDB');

 const existing = await User.findOne({ email: ADMIN_EMAIL });
 if (existing) {
 console.log(` Admin already exists: ${ADMIN_EMAIL}`);
 if (existing.role !== 'admin') {
 existing.role = 'admin';
 await existing.save();
 console.log(' Promoted existing account to admin');
 }
 } else {
 await User.create({
 name: ADMIN_NAME,
 email: ADMIN_EMAIL,
 password: ADMIN_PASSWORD,
 role: 'admin',
 isVerified: true,
 });
 console.log(` Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
 console.log(' CHANGE THE PASSWORD IMMEDIATELY after first login.');
 }
 } catch (err) {
 console.error(' Seed failed:', err.message);
 process.exit(1);
 } finally {
 await mongoose.disconnect();
 }
})();
