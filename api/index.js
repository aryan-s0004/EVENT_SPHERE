/**
 * api/index.js — Vercel Serverless Function entry point.
 */
'use strict';

require('dotenv').config();

const { connectDB } = require('../backend/db/index');
const createApp     = require('../backend/app');
const logger        = require('../backend/utils/logger');

const app = createApp();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (err) {
    logger.error('Vercel API Error:', { message: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
