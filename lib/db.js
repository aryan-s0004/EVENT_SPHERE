// lib/db.js
// ─────────────────────────────────────────────────────────────────────────────
// MongoDB connection helper for Vercel serverless functions.
//
// IMPORTANT: In serverless environments, a new function invocation may spin up
// a completely fresh Node.js process.  To avoid creating a new MongoDB
// connection on every single HTTP request we cache the connection on the
// Node.js *global* object, which persists across invocations within the same
// container (warm starts).  Cold starts will still open a new connection.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// Re-use whatever connection was established by a previous invocation of this
// container.  Storing on `global` is the standard Vercel / Next.js pattern.
const globalCache = global.__eventsphereMongoCache || {
  conn: null,      // resolved Mongoose connection
  promise: null,   // in-flight connection promise (prevents duplicate connects)
  listenersAttached: false,
  state: {
    ready: false,
    lastError: null,
    lastConnectedAt: null,
  },
};

global.__eventsphereMongoCache = globalCache;

// Attach connection-lifecycle listeners exactly once per process.
const attachListeners = () => {
  if (globalCache.listenersAttached) return;

  mongoose.connection.on('connected', () => {
    globalCache.state.ready = true;
    globalCache.state.lastError = null;
    globalCache.state.lastConnectedAt = new Date().toISOString();
    console.log('[db] MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    globalCache.state.ready = false;
    console.warn('[db] MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    globalCache.state.ready = false;
    globalCache.state.lastError = err.message;
    console.error('[db] MongoDB error:', err.message);
  });

  globalCache.listenersAttached = true;
};

/**
 * connectDB()
 * Connects to MongoDB Atlas using the MONGO_URI environment variable.
 * Returns the cached connection if one already exists (warm start).
 *
 * NOTE: No PORT is used because Vercel automatically manages serverless
 * function execution — there is no persistent server process to bind a port.
 */
const connectDB = async () => {
  attachListeners();

  if (!process.env.MONGO_URI) {
    globalCache.state.ready = false;
    globalCache.state.lastError = 'MONGO_URI is not configured';
    console.error('[db] Skipping connect: MONGO_URI missing');
    return null;
  }

  // Return existing live connection immediately (warm invocation).
  if (globalCache.conn && mongoose.connection.readyState === 1) {
    return globalCache.conn;
  }

  // Deduplicate concurrent connect attempts within the same container.
  if (!globalCache.promise) {
    globalCache.promise = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        // bufferCommands: false prevents Mongoose from queuing operations while
        // disconnected — fail fast instead of silently hanging.
        bufferCommands: false,
      })
      .then((conn) => {
        globalCache.conn = conn;
        return conn;
      })
      .catch((err) => {
        globalCache.state.ready = false;
        globalCache.state.lastError = err.message;
        globalCache.promise = null; // allow retry on next invocation
        console.error('[db] Connection failed:', err.message);
        return null;
      });
  }

  return globalCache.promise;
};

/** Returns true only when the connection is fully established. */
const isDatabaseReady = () =>
  mongoose.connection.readyState === 1 && globalCache.state.ready;

/** Returns a snapshot of the connection health (used by /api/health). */
const getDatabaseHealth = () => ({
  ready: isDatabaseReady(),
  readyState: mongoose.connection.readyState,
  lastConnectedAt: globalCache.state.lastConnectedAt,
  lastError: globalCache.state.lastError,
});

module.exports = { connectDB, isDatabaseReady, getDatabaseHealth };
