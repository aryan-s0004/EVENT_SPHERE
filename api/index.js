/**
 * api/index.js
 * Vercel Serverless Function entry point.
 * Build Trigger: 2026-04-12 04:05 (Careful Unified Migration)
 */
'use strict';

// Load environment variables
require('dotenv').config();

const { connectDB } = require('../backend/db/index');
const createApp     = require('../backend/app');
const logger        = require('../backend/utils/logger');

// Initialize the app factory
const app = createApp();

// Vercel serverless function export
module.exports = async (req, res) => {
  try {
    // Ensure database is connected (uses cached connection if available)
    await connectDB();
    
    // Pass the request to the Express app
    return app(req, res);
  } catch (err) {
    logger.error('Vercel API Error:', { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
