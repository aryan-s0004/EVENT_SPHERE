# EventSphere

A production-grade full-stack event management platform. Users discover and book events; admins create events and moderate bookings. Deployed on **Vercel** (serverless) with an optional Express server for self-hosted environments.

---

## Features

- **OTP email verification** — 6-digit code, 10-minute expiry, 60-second resend cooldown
- **Google OAuth** — one-click sign-in via Google Identity Services
- **Event browsing** — paginated list with category filter and full-text search
- **Booking workflow** — free events auto-approve; paid events require admin approval
- **Atomic seat management** — `findOneAndUpdate` with `$gte` guard prevents overselling
- **Admin dashboard** — manage events, view all bookings, approve / reject with email notifications
- **Rate limiting** — three-tier (auth: 10/15 min, API: 100/min, global: 300/min)
- **Input validation** — Zod schemas with structured error messages
- **Security headers** — Helmet, strict CORS, X-Frame-Options, Referrer-Policy
- **Compression** — gzip via `compression` middleware (60–75% response size reduction)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Axios |
| Serverless API | Vercel Serverless Functions (Node.js 20) |
| Express API | Express 4, MVC + Service Layer architecture |
| Database | MongoDB Atlas (Mongoose 8, connection pooling) |
| Auth | JWT (HS256, 7d expiry) + Google OAuth ID token |
| Validation | Zod (TypeScript-native, works in plain JS) |
| Email | Nodemailer (Gmail SMTP) with console fallback |
| Logging | Winston (dev: colorized, prod: JSON) |
| Security | Helmet, cors, express-rate-limit |
| Testing | K6 load tests (smoke / load / stress / spike) |
| Hosting | Vercel (primary) or Render/Railway (Express) |

---

## Folder Structure

```
eventsphere/
├── api/                        # Vercel serverless functions (file-based routing)
│   ├── auth/
│   │   ├── register.js         POST /api/auth/register
│   │   ├── verify-otp.js       POST /api/auth/verify-otp
│   │   ├── login.js            POST /api/auth/login
│   │   ├── google.js           POST /api/auth/google
│   │   ├── forgot-password.js  POST /api/auth/forgot-password
│   │   ├── verify-reset-otp.js POST /api/auth/verify-reset-otp
│   │   ├── reset-password.js   POST /api/auth/reset-password
│   │   └── profile.js          GET|PUT /api/auth/profile
│   ├── events/
│   │   ├── index.js            GET (list) | POST (create)
│   │   ├── [id].js             GET | PUT | DELETE
│   │   └── admin/
│   │       ├── all.js          GET /api/events/admin/all
│   │       └── [id]/status.js  PATCH /api/events/admin/:id/status
│   ├── bookings/
│   │   ├── index.js            POST /api/bookings
│   │   ├── my.js               GET /api/bookings/mine
│   │   ├── [id]/cancel.js      PATCH /api/bookings/:id/cancel
│   │   └── admin/
│   │       ├── all.js          GET /api/bookings/admin/all
│   │       └── [id]/status.js  PATCH /api/bookings/admin/:id/status
│   └── health.js               GET /api/health
│
├── lib/                        # Shared backend logic (api/ and server/ both import from here)
│   ├── db.js                   MongoDB global connection cache (serverless-safe)
│   ├── auth.js                 JWT helpers + withAuth / withAdminAuth wrappers
│   ├── models/
│   │   ├── User.js
│   │   ├── Event.js
│   │   └── Booking.js
│   └── utils/
│       ├── sendEmail.js
│       ├── generateOTP.js
│       └── fileToDataUri.js
│
├── server/                     # Express MVC server (Render / Railway / local)
│   ├── app.js                  Express factory (helmet, cors, compression, morgan)
│   ├── server.js               Entry point (env validate → DB → listen)
│   ├── config/env.js           Fail-fast env validation
│   ├── controllers/            Thin HTTP handlers
│   ├── services/               Business logic (authService, eventService, bookingService)
│   ├── routes/                 Route definitions with middleware chains
│   ├── middlewares/            auth, error, rateLimiter, upload, validate
│   ├── validators/             Zod schemas (auth.validators, event.validators)
│   └── utils/                  ApiError, asyncHandler, logger (Winston)
│
├── client/                     # React / Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── services/api.js     Axios instance — /api prefix (same domain, no CORS)
│   └── vite.config.js          Dev proxy → localhost:5000
│
├── tests/
│   └── k6-load-test.js         K6 load tests (smoke / load / stress / spike)
├── docs/
│   ├── PROJECT_AUDIT.md        Full codebase audit report
│   ├── PERFORMANCE_REPORT.md   K6 results + SLO tracking
│   └── DEPLOYMENT_GUIDE.md     Step-by-step deploy + Google OAuth setup
├── .env.example                Environment variable template
├── vercel.json                 Vercel deployment config
└── package.json                Root deps for serverless functions
```

---

## Quick Start (Local)

### Option A — Vercel Dev (serverless emulation)

```bash
npm install -g vercel
git clone https://github.com/your-username/eventsphere.git
cd eventsphere
npm install && npm run install:client
cp .env.example .env       # fill in MONGO_URI, JWT_SECRET, etc.
vercel dev                 # http://localhost:3000
```

### Option B — Express Dev Server

```bash
# Terminal 1
cd server && npm install
npm run dev                # nodemon on port 5000

# Terminal 2
cd client && npm install
npm run dev                # Vite on port 5173, proxies /api → 5000
```

---

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | 32+ char random secret (`openssl rand -hex 32`) |
| `JWT_EXPIRE` | Yes | Token lifetime, e.g. `7d` |
| `EMAIL_HOST` | No | SMTP host, e.g. `smtp.gmail.com` |
| `EMAIL_PORT` | No | SMTP port, e.g. `587` |
| `EMAIL_USER` | No | Gmail address |
| `EMAIL_PASS` | No | Gmail App Password |
| `OTP_CONSOLE_FALLBACK` | No | `true` to log OTPs to console instead of emailing |
| `GOOGLE_CLIENT_ID` | No | Enables Google Sign-In server-side |
| `ALLOWED_ORIGINS` | No | Comma-separated origins for Express CORS |
| `VITE_API_BASE_URL` | No | `/api` for Vercel; `http://localhost:5000/api` for standalone |
| `VITE_GOOGLE_CLIENT_ID` | No | Same as `GOOGLE_CLIENT_ID` — used by React |

---

## API Reference

### Auth `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Create account, send email OTP |
| POST | `/verify-otp` | Public | Verify OTP → JWT |
| POST | `/login` | Public | Email + password → JWT |
| POST | `/google` | Public | Google ID token → JWT |
| POST | `/forgot-password` | Public | Send reset OTP |
| POST | `/verify-reset-otp` | Public | Verify reset OTP |
| POST | `/reset-password` | Public | Set new password |
| GET | `/profile` | User | Get profile |
| PUT | `/profile` | User | Update name / phone / avatar |

### Events `/api/events`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List active events — `?category=Tech&search=conf&page=1&limit=10` |
| GET | `/:id` | Public | Single event detail |
| POST | `/` | Admin | Create event (multipart/form-data or JSON) |
| PUT | `/:id` | Admin | Update event |
| DELETE | `/:id` | Admin | Delete event and all bookings |
| GET | `/admin/all` | Admin | All events including inactive |
| PATCH | `/:id/status` | Admin | Toggle `active` / `inactive` |

### Bookings `/api/bookings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | User | Book event (`{ eventId, seats }`) |
| GET | `/mine` | User | User's own bookings |
| PATCH | `/:id/cancel` | User | Cancel booking |
| GET | `/admin/all` | Admin | All bookings (no admin-created rows) |
| PATCH | `/:id/process` | Admin | `{ status: "approved" \| "rejected" }` |

### System

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns timestamp |

---

## Booking Workflow

```
User books free event
  └─► Atomic seat deduction (findOneAndUpdate $gte guard)
  └─► Booking created as "approved"
  └─► Confirmation email (fire-and-forget)

User books paid event
  └─► Booking created as "pending" (no seat deduction)
  └─► Pending email to user

Admin approves pending booking
  └─► Atomic seat deduction
      ├─ Enough seats → status = "approved", confirmation email
      └─ No seats left → auto-reject, apology email

User cancels approved booking
  └─► Seats restored to event
  └─► Status = "cancelled"
```

---

## Security

- **Helmet** — sets 11 HTTP security headers per request
- **Strict CORS** — only listed origins allowed (no wildcard `*` in production)
- **Three-tier rate limiting** — auth endpoints throttled independently from API
- **Zod validation** — all request bodies parsed and stripped before hitting services
- **Atomic operations** — `findOneAndUpdate` with `$gte` for seat deduction (no race conditions)
- **Partial unique index** — prevents duplicate active bookings at the DB level
- **JWT HS256** — short-lived tokens, secret enforced on startup
- **Password hashing** — bcryptjs with salt rounds 10

---

## Load Test Results (Summary)

| Scenario | VUs | p95 | Error rate | SLO |
|---|---|---|---|---|
| Smoke | 1 | 5 ms | 0% | Pass |
| Load | 50 | 243 ms | 0% | Pass |
| Stress | 300 | 712 ms | 0.08%* | Pass |
| Spike | 500 | 1 340 ms | 1.1%* | Marginal |

\* 429 responses from rate limiter, not application errors.

Full report: [docs/PERFORMANCE_REPORT.md](docs/PERFORMANCE_REPORT.md)

---

## Deployment

See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for:
- Vercel step-by-step setup
- Express server on Render / Railway
- Google OAuth URI configuration
- MongoDB Atlas index setup
- Admin user seeding
- Post-deploy checklist

---

## Roadmap

- [ ] Cloudinary / S3 for image storage (replace base64 in MongoDB)
- [ ] Redis for rate limiting (multi-instance support)
- [ ] Compound index `{ status, date, category }` on Event collection
- [ ] Atlas Search for full-text event search
- [ ] WebSocket / SSE for real-time booking status updates
- [ ] Jest + Supertest integration test suite
- [ ] Admin analytics dashboard (event stats, booking trends)
- [ ] Open Graph meta tags for social sharing
