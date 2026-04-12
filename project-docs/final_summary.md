EVENTSPHERE — FINAL PROJECT SUMMARY
===================================

Project Overview
----------------
EventSphere is a full-stack event management platform where users can browse events, book seats, and manage bookings. Admins manage the event catalogue and approve/reject bookings for paid events.

Live URL: https://eventosphere.vercel.app

Full Architecture
-----------------

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser) │
│ React 18 + Vite │ React Router v6 │ Axios │ react-hot-toast │
└───────────────────────────────┬─────────────────────────────────┘
 │ HTTPS
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ VERCEL EDGE / CDN │
│ Static files (frontend/dist/) served from global CDN │
│ /api/* rewrites → serverless function │
└───────────────────────────────┬─────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ api/index.js (Serverless) │
│ connectDB() → cached Mongoose connection │
│ createApp() → Express app factory │
└───────────────────────────────┬─────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXPRESS APPLICATION │
│ │
│ Middleware stack: │
│ Helmet → CORS → Compression → Morgan → Body Parser │
│ → Global Rate Limiter → Routes → 404 → Error Handler │
│ │
│ Route handlers: │
│ /api/auth → auth-routes.js → auth-controller.js │
│ /api/events → event-routes.js → event-controller.js │
│ /api/bookings → booking-routes.js → booking-controller.js │
│ /api/seed → seed-routes.js (admin init + event seed) │
│ │
│ Services (business logic): │
│ auth-service.js │ event-service.js │ booking-service.js │
└───────────────────────────────┬─────────────────────────────────┘
 │ Mongoose ODM
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ MONGODB ATLAS (M0 Free) │
│ Collections: users │ events │ bookings │
└─────────────────────────────────────────────────────────────────┘

External services:
 Email: Resend API (primary) → Gmail SMTP (fallback) → Console log
```

Features List
-------------

  Authentication
- Register with email OTP verification (6-digit, 10 min expiry)
- Login with JWT (7-day token, stored in localStorage)
- Forgot Password — OTP-based 3-step reset flow
- Protected routes (user and admin role separation)
- Profile view and update (name, phone, avatar)
- Auto-logout on token expiry

  Event Management
- Public event browsing with pagination (default 10/page, max 50)
- Filter by category (Tech, Sports, Business, Music, Art, Food, Other)
- Text search across title and location
- Event detail page with full metadata
- Admin: create / edit / delete events
- Admin: toggle events active / inactive
- Image upload (stored as base64 data URI)

  Booking System
- Book 1–10 seats per event
- Free events: instant approval
- Paid events: pending → admin approve / reject
- Seat count tracking (availableSeats decrements on approval)
- User "My Bookings" page with status badges
- Cancel own booking (seats returned to pool)

  Admin Dashboard
- Stats cards (total events, bookings, pending count)
- Booking status analytics (approved / pending / rejected / cancelled)
- Top events by booking count (with fill bar)
- Events management table (CRUD + status toggle)
- Bookings management table (approve / reject per row)

  Infrastructure
- Single Vercel deployment (frontend + API)
- MongoDB Atlas with connection caching
- Three-tier email delivery (Resend → SMTP → console)
- Global error handler with structured JSON responses
- Zod request validation on all endpoints
- Rate limiting (10 req/15 min on auth, 100 req/min on API)
- Winston structured logging
- Helmet security headers
- CORS allowing same-origin + `.vercel.app` subdomains
- Seed endpoint for one-click database initialization

Tech Stack
----------

| Layer | Technology | Version | Why |
| Frontend framework | React | 18.2 | Industry standard, concurrent features |
| Frontend build | Vite | 5.x | 10x faster than CRA, native ESM |
| Routing (client) | React Router | v6 | Declarative, nested routes |
| HTTP client | Axios | 1.x | Interceptors for auth header injection |
| Toast notifications | react-hot-toast | 2.x | Minimal, accessible |
| Backend framework | Express | 4.x | Flexible, widely understood |
| Database | MongoDB Atlas | — | Managed, free tier, Mongoose ODM |
| ODM | Mongoose | 8.x | Schema enforcement, middleware hooks |
| Auth | JWT + bcryptjs | — | Stateless, serverless-compatible |
| Validation | Zod | 3.x | TypeScript-native, clean error messages |
| Email (primary) | Resend | 6.x | HTTPS API, works on Vercel |
| Email (fallback) | Nodemailer | 8.x | SMTP Gmail port 465 |
| Logging | Winston | 3.x | Structured JSON logs |
| Deployment | Vercel | — | CDN + serverless, free tier |
| Rate limiting | express-rate-limit | 7.x | Per-IP, configurable windows |
| Security headers | Helmet | 7.x | XSS, clickjacking, MIME protection |
| Compression | compression | 1.x | gzip responses |
| File upload | Multer | 1.x | In-memory buffer, no temp files |
| Load testing | k6 | — | Scenario-based, threshold SLOs |

Project Folder Structure
------------------------
```
EVENT_SPHERE/
├── api/
│ └── index.js ← Vercel serverless entry point
├── backend/
│ ├── api/ ← Route definitions
│ │ ├── auth-routes.js
│ │ ├── event-routes.js
│ │ ├── booking-routes.js
│ │ └── seed-routes.js
│ ├── controllers/ ← HTTP request/response only
│ ├── services/ ← Business logic
│ ├── models/ ← Mongoose schemas
│ ├── middleware/ ← Auth, validation, rate limit, upload, errors
│ ├── validators/ ← Zod schemas
│ ├── utils/ ← OTP, email, logger, errors, async-handler
│ ├── db/ ← MongoDB connect + env validation
│ └── app.js ← Express app factory
├── frontend/
│ ├── src/
│ │ ├── pages/ ← Full page components
│ │ ├── components/ ← Reusable UI components
│ │ ├── context/ ← AuthContext, ThemeContext
│ │ └── services/ ← Axios instance + authStorage
│ └── vite.config.js
├── scripts/
│ └── seed.js ← CLI seed script
├── tests/
│ └── k6-load-test.js ← k6 load test scenarios
├── project-docs/ ← This documentation
├── vercel.json
└── package.json
```

Resume-Ready Description
------------------------

  Note: EventSphere — Full-Stack Event Management Platform 
  Note: MERN Stack + JWT Auth + OTP Email + Vercel Deployment
  Note: 
  Note: Built a production-deployed web application enabling users to browse, book, and manage event tickets. Implemented complete OTP-based authentication (register → verify → login → forgot password) with 6-digit expiring codes delivered via Resend API. Designed an MVC + Service Layer backend with Zod request validation, Mongoose ODM, role-based access control (user/admin), and global error handling. Admin panel provides real-time booking approval/rejection, event CRUD, and an analytics dashboard. Deployed both React SPA and Express API as a unified Vercel project (frontend on CDN, API as serverless functions). Configured three-tier email delivery (Resend → SMTP → console fallback) to handle serverless SMTP restrictions. Wrote k6 load tests with p95 < 500ms SLO targets.
  Note: 
  Note: Tech: React 18, Vite, Express, MongoDB Atlas, Mongoose, JWT, bcryptjs, Zod, Nodemailer, Resend, Helmet, Winston, Vercel, k6

Future Features (Design Only — Not Implemented)
-----------------------------------------------

  1. Delete Account

API: `DELETE /api/auth/account` 
Auth: Protected (user can only delete their own account; admin can delete any)

Design options:

Option A — Hard Delete (immediate)
```
1. User requests delete (may require password confirmation)
2. Cancel all pending bookings (return seats)
3. Anonymise approved bookings (set user = null, preserve booking record)
4. Delete user document
5. Invalidate all JWTs (store blacklist in Redis, or use short token lifetime)
```

Option B — Soft Delete (recommended for production)
```
1. Add deletedAt: Date field to User schema
2. Set deletedAt = now (user "deleted" but record retained)
3. Block login for users where deletedAt is set
4. All bookings/history preserved for audit trail
5. Schedule hard delete via CRON after 30-day grace period
```

Frontend: Settings page → "Delete Account" button → confirmation modal with typed email → DELETE request → logout + redirect home.

  2. Update Email Address

API: `PATCH /api/auth/update-email` 
Auth: Protected (JWT required)

Flow:
```
1. User requests email change with { newEmail, password }
2. Verify current password (prevents unauthorized changes)
3. Check newEmail not already taken
4. Generate 6-digit OTP, send to newEmail
5. Store pendingEmail + pendingEmailOtp + pendingEmailOtpExpiry on user doc

POST /api/auth/confirm-email-change
 { otp: "123456" }
6. Verify OTP matches pendingEmail OTP
7. Update email = pendingEmail, clear pending fields
8. Issue new JWT (email is in token payload)
```

Security considerations:
- Password confirmation before any email change
- OTP sent to NEW email (verifies they control it)
- Old email gets a notification: "Your email was changed. If this wasn't you, contact support."
- Previous JWT should be invalidated after email change

Schema additions:
```js
pendingEmail: String,
pendingEmailOtp: String,
pendingEmailOtpExpiry: Date,
```

---

Code Cleanup & DB Reset (2026-04-13)
=====================================

Admin Dashboard Cleanup
-----------------------
Removed two stat cards that depended on the optional analytics endpoint:
- Total Users    (required analytics.users.total)
- Revenue Confirmed (required analytics.bookings.revenue)

Kept four cards that rely only on local state:
- Total Events
- Active Events
- Total Bookings
- Pending Approval

Result: dashboard loads correctly even when the analytics endpoint is unavailable.
Grid auto-adjusts via CSS repeat(auto-fit, minmax(160px, 1fr)).

Code Compression Applied
------------------------
Files cleaned (comments + debug logs removed, logic unchanged):

| File | Change |
|------|--------|
| backend/app.js | Removed 21-line verbose factory comment block |
| backend/services/auth-service.js | Removed 16-line header + all Step N: inline comments |
| backend/utils/send-email.js | Removed 16-line setup comment + 6 console.log delivery messages |
| api/index.js | Removed stale build-trigger timestamp + redundant inline comments |

No logic, no API contracts, no variable names were altered.

DB Reset Script
---------------
Created: scripts/resetData.js

Deletes: all non-admin users, all bookings.
Preserves: admin account, all events.

Run:
```bash
node -r dotenv/config scripts/resetData.js dotenv_config_path=.env
```

Post-reset system state:
- Admin credentials intact
- Events catalogue intact
- Zero users (excluding admin)
- Zero bookings

Deployment Status
-----------------
All changes are LOCAL ONLY.
No git commits made. No push. No deployment triggered.
Project is deployment-ready for Vercel.
