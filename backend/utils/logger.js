/**
 * server/utils/logger.js
 * Centralised Winston logger.
 *
 * Why Winston?
 *  - Structured JSON output in production → easily ingested by Datadog, Logtail, etc.
 *  - Human-readable coloured output in development
 *  - Never use console.log/error in production code — scrub them with this
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB error', { err: error.message });
 */
const { createLogger, format, transports } = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = format;

const isDev = process.env.NODE_ENV !== 'production';

// Dev format: coloured, readable single line
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  })
);

// Prod format: structured JSON for log aggregators
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level:      process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format:     isDev ? devFormat : prodFormat,
  transports: [new transports.Console()],
  // In production, add a file transport or use a log-drain service:
  // new transports.File({ filename: 'logs/error.log', level: 'error' }),
});

module.exports = logger;
