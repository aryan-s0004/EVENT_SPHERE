/**
 * db/index.js — MongoDB Connection
 * ----------------------------------
 * Connects to MongoDB Atlas using the MONGO_URI environment variable.
 *
 * WHY cachedDb?
 *   Vercel runs backend code as serverless functions.
 *   Each incoming request could spin up a fresh function instance.
 *   Without caching, every request would open a NEW database connection.
 *   With cachedDb, if the function is still warm (reused), it reuses
 *   the existing connection — much faster (~120ms vs ~600ms cold).
 *
 * Usage:
 *   const { connectDB } = require('./db');
 *   await connectDB();  // safe to call on every request
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Holds the Mongoose connection across warm serverless invocations
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb) {
    logger.info('Using cached database connection');
    return cachedDb;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    cachedDb = conn;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("DB connection error:", error);
    logger.error(`Error: ${error.message}`);
    // In serverless, we don't want to process.exit(1) as it kills the instance
    // but the next invocation might work if it's a transient error.
    throw error;
  }
};

module.exports = { connectDB };

