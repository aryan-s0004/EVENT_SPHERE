/**
 * server/app.js
 * Express application factory.
 *
 * Configures:
 *  - Security: helmet, strict CORS, global rate limiter
 *  - Parsing:  JSON (5 kb limit), URL-encoded
 *  - DX:       morgan request logging (dev only), compression
 *  - Routes:   /api/auth, /api/events, /api/bookings
 *  - Error:    global async error handler
 */
'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const compression = require('compression');

const { globalLimiter }  = require('./middleware/rate-limiter-middleware');
const { errorHandler }   = require('./middleware/error-middleware');
const logger             = require('./utils/logger');

const authRoutes    = require('./api/auth-routes');
const eventRoutes   = require('./api/event-routes');
const bookingRoutes = require('./api/booking-routes');

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// In production on Vercel, the frontend and backend share the same origin.
// We allow all subdomains of vercel.app for convenience, but ideally, you'd be specific.
const corsOptions = {
  origin: (origin, cb) => {
    // Allow server-to-server (no origin)
    if (!origin) return cb(null, true);

    // Allow local development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return cb(null, true);
    }

    // Allow listed origins or any Vercel deployment
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }

    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials:         true,
  methods:             ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:      ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders:      ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  optionsSuccessStatus: 200,
};


// ─── App factory ─────────────────────────────────────────────────────────────

const createApp = () => {
  const app = express();

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy:  { policy: 'cross-origin' }, // allow CDN images
    contentSecurityPolicy:      false,                       // SPA manages its own CSP
  }));

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // ── Compression ────────────────────────────────────────────────────────────
  app.use(compression());

  // ── Request logging ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  } else {
    // JSON-structured logs in prod — pipe through Winston
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '5kb' }));
  app.use(express.urlencoded({ extended: false, limit: '5kb' }));

  // ── Global rate limiter (safety net) ──────────────────────────────────────
  app.use(globalLimiter);

  // ── Health check (before auth middleware) ─────────────────────────────────
  app.get('/api/health', (_req, res) =>
    res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
  );

  // ── API routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth',     authRoutes);
  app.use('/api/events',   eventRoutes);
  app.use('/api/bookings', bookingRoutes);

  // ── 404 handler ────────────────────────────────────────────────────────────
  app.use((_req, res) =>
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route not found' })
  );

  // ── Global error handler ───────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
