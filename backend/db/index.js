const mongoose = require('mongoose');
const logger = require('../utils/logger');

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
    logger.error(`Error: ${error.message}`);
    // In serverless, we don't want to process.exit(1) as it kills the instance
    // but the next invocation might work if it's a transient error.
    throw error;
  }
};

module.exports = { connectDB };

