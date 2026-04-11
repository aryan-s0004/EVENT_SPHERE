/**
 * server/server.js
 * Entry point — loads env, connects DB, starts Express.
 *
 * Import order matters:
 *  1. dotenv (must be first so all subsequent imports see env vars)
 *  2. validateEnv (fail fast on missing vars)
 *  3. connectDB
 *  4. createApp
 */
'use strict';

require('dotenv').config();

const validateEnv = require('./db/env');
validateEnv();

const { connectDB } = require('./db/index');
const createApp     = require('./app');
const logger        = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    logger.info('MongoDB connected');

    const app = createApp();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // ── Graceful shutdown ────────────────────────────────────────────────────
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force-exit if connections don't drain within 10 s
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', { reason: String(reason) });
      shutdown('unhandledRejection');
    });
  } catch (err) {
    logger.error('Failed to start server', { err: err.message });
    process.exit(1);
  }
};

start();
