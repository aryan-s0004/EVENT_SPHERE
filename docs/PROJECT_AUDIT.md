# EventSphere — Production Code Audit
**Date:** April 2026  
**Analyst:** Senior Full-Stack / DevOps Review  
**Repository:** https://github.com/aryan-s0004/EVENT_SPHERE

---

## 1. Architecture Overview

EventSphere is a MERN-stack event booking platform with two parallel deployment paths:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│              React 18 + Vite (client/)                  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
           ┌───────────────┴───────────────┐
           │                               │
    ┌──────▼──────┐              ┌─────────▼────────┐
    │  VERCEL CDN  │              │   RENDER / RAILWAY│
    │  (static)    │              │   Express server  │
    │  client/dist │              │   server/         │
    └──────┬───────┘              └─────────┬─────────┘
           │ /api/*                         │ :5000
           │                               │
    ┌──────▼───────────────────────────────▼─────────┐
    │             Vercel Serverless Functions          │
    │                    api/                          │
    └──────────────────────────┬──────────────────────┘
                               │
    ┌──────────────────────────▼──────────────────────┐
    │              Shared Business Logic               │
    │                    lib/                          │
    │  db.js │ auth.js │ models/ │ utils/             │
    └──────────────────────────┬──────────────────────┘
                               │ Mongoose ODM
    ┌──────────────────────────▼──────────────────────┐
    │               MongoDB Atlas                      │
    │  Collections: users │ events │ bookings          │
    └─────────────────────────────────────────────────┘
```

### Data Flow — User Booking an Event

```
Browser → POST /api/bookings
  → Vercel routes to api/bookings/index.js
    → connectDB() [cached Mongoose connection]
    → withAuth(req, res, handler) [JWT verify → User.findById]
    → Event.findOneAndUpdate (atomic seat deduction)
    → Booking.create (status: approved | pending)
    → sendEmail (fire-and-forget)
  ← 201 { success, booking, event }
```

---

## 2. Folder Structure Justification

```
EVENT_SPHERE/
├── api/          Vercel serverless functions (1 file = 1 HTTP endpoint)
├── lib/          Shared backend logic (imported by both api/ and server/)
│   ├── db.js           MongoDB connection with global cache
│   ├── auth.js         JWT helpers + withAuth/withAdminAuth wrappers
│   ├── models/         Mongoose schemas (re-registration guarded)
│   └── utils/          Email, OTP, error class, file conversion
├── server/       Express MVC app (for Render/Railway deployment)
│   ├── app.js          Express app factory (no listen())
│   ├── server.js       Entry point with app.listen()
│   ├── config/         Env validation, DB bootstrap
│   ├── controllers/    HTTP layer — parse req, call service, format res
│   ├── services/       Business logic — DB ops, domain rules
│   ├── routes/         Express Router definitions
│   ├── middlewares/    Auth, error handler, rate limiter, logger
│   ├── validators/     Zod schemas for request validation
│   └── utils/          asyncHandler, logger, ApiError
├── client/       React 18 + Vite SPA
│   └── src/
│       ├── pages/      Route-level components
│       ├── components/ Reusable UI pieces
│       ├── context/    AuthContext, ThemeContext
│       └── services/   Axios instance + token storage
├── tests/        k6 load tests
├── docs/         Audit, deployment guide, performance report
├── vercel.json   Vercel build + routing config
└── package.json  Root deps for Vercel serverless functions
```

**Why NOT a simple frontend/ + backend/ split?**
- `lib/` is shared between `api/` (Vercel) and `server/` (Render) — zero duplication
- `api/` follows Vercel's file-based routing — no extra config required
- `server/` can be deployed independently on any Node.js host
- Separation of HTTP layer (controllers) from domain logic (services) makes unit testing trivial

---

## 3. Issues Found

### 🔴 CRITICAL

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | No input validation in serverless functions | api/auth/*.js | SQL/NoSQL injection, bad data in DB |
| C2 | `console.log/error` shipped to production | All api/ files | Leaks internals, pollutes logs |
| C3 | No rate limiting on auth endpoints | api/auth/login.js, register.js | Brute force, credential stuffing |
| C4 | CORS wildcard `Access-Control-Allow-Origin: *` | vercel.json | CSRF risk in authenticated contexts |
| C5 | Admin seeding has no server-side mechanism | No bootstrapAdmin in api/ | Cannot create first admin on Vercel |
| C6 | Image stored as base64 in MongoDB | api/events/create.js, api/auth/profile.js | Documents hit 16MB limit, slow queries |
| C7 | JWT_SECRET fallback not enforced | lib/auth.js | App starts without secret → unsigned tokens |

### 🟡 MODERATE

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | EventDetail polls every 5 seconds unconditionally | client/src/pages/EventDetail.jsx:40 | Unnecessary API hammering |
| M2 | No `useCallback` on `fetchEvent` — recreated each render | EventDetail.jsx | ESLint warning + subtle re-render loop risk |
| M3 | Error responses shape inconsistent (`{success}` vs legacy) | Multiple api/ files | Frontend error parsing fragile |
| M4 | `multer` re-instantiated per request in serverless | api/auth/profile.js, api/events/*.js | Wastes memory on warm starts |
| M5 | No MongoDB query projection — full documents returned | All models | Leaks sensitive user fields to client |
| M6 | Booking email HTML is inline strings | api/bookings/index.js | Unmaintainable, no HTML escaping |
| M7 | No request body size limit in vercel.json | vercel.json | DoS via oversized JSON payloads |

### 🟢 MINOR

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| N1 | `authStorage.js` migration reads localStorage on every call | authStorage.js:11-33 | Tiny perf cost after first call |
| N2 | Inline styles on every render (object creation per render) | All page components | Slight render overhead |
| N3 | No `loading` state in Events page during filter change | Events.jsx | UI flicker |
| N4 | Missing `alt` text on event images in Events listing | Events.jsx | Accessibility (a11y) failure |
| N5 | `vercel.json` CORS headers applied per-response | vercel.json | Preflight (OPTIONS) not handled |

---

## 4. Fix Recommendations

### C1 — Add Zod validation to all api/ handlers
```javascript
// lib/validators/auth.validators.js
const { z } = require('zod');
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### C3 — Add per-IP rate limiting via Upstash Redis
For Vercel (stateless), use `@upstash/ratelimit` with a Redis store.
For server/ (Express), use `express-rate-limit` with in-memory store.

### C4 — Restrict CORS to known origins
```json
"Access-Control-Allow-Origin": "https://your-app.vercel.app"
```

### C6 — Move media to Cloudinary
Replace `toDataUri()` → `uploadToCloudinary()` → store URL string.

### C7 — Enforce JWT_SECRET on startup
```javascript
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
```

### M1 — Replace polling with smarter refresh
Poll only when tab is visible + user is authenticated + event has available seats.
Add `visibilitychange` listener and exponential backoff.

### M4 — Hoist multer instance outside handler
```javascript
const upload = multer({ ... }); // module level
module.exports = async function handler(req, res) { ... }
```

---

## 5. Security Checklist

| Control | Status |
|---------|--------|
| Passwords hashed (bcrypt, 10 rounds) | ✅ |
| JWT signed with HS256 | ✅ |
| OTP expiry enforced | ✅ |
| SessionStorage (not localStorage) for tokens | ✅ |
| Multer file type + size validation | ✅ |
| Duplicate booking prevention (partial unique index) | ✅ |
| Atomic seat deduction (findOneAndUpdate) | ✅ |
| Input validation | ❌ Missing in api/ |
| Rate limiting | ❌ Missing |
| Helmet security headers | ❌ Missing in server/ |
| CORS restricted | ❌ Wildcard in vercel.json |
| SQL/NoSQL injection guards (Mongoose sanitization) | ⚠️ Partial (Mongoose escapes, but inputs unvalidated) |
| XSS protection | ❌ No CSP header |
| Admin account seeding (server-side) | ❌ Missing in api/ context |

---

## 6. Performance Assessment

| Metric | Current | Target |
|--------|---------|--------|
| DB connection strategy | Global cache (correct) | — |
| Image storage | Base64 in MongoDB (~2.7× bloat) | Cloudinary URL |
| API response projection | Full document | Select specific fields |
| Frontend bundle | Not analyzed (Vite default) | Code-split per route |
| Polling interval | 5s unconditional | On-demand or SSE |
| MongoDB indexes | status+date, user+event (partial) | Add text index for search |
