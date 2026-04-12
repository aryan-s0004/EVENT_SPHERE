'use strict';

/**
 * scripts/resetData.js
 * Resets the database for a clean test environment.
 * Deletes all non-admin users and all bookings. Events and admin are preserved.
 *
 * Run: node scripts/resetData.js
 */

const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { MongoClient } = require('mongodb');

async function resetData() {
  const uri    = process.env.MONGO_URI;
  const dbName = uri.split('/').pop().split('?')[0];

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const deletedUsers    = await db.collection('users').deleteMany({ role: { $ne: 'admin' } });
    const deletedBookings = await db.collection('bookings').deleteMany({});

    console.log(`Users deleted:    ${deletedUsers.deletedCount}`);
    console.log(`Bookings deleted: ${deletedBookings.deletedCount}`);
    console.log('Done — admin and events preserved.');
  } finally {
    await client.close();
  }
}

resetData().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
