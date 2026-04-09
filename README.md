# EventSphere

A full-stack event management platform where users discover and book events while admins create events and moderate bookings.

Fully deployed on **Vercel** — frontend, backend (serverless), and database (MongoDB Atlas) all under one domain.

---

## 1. Project Overview

EventSphere lets:

- **Users** — register (OTP-verified), browse events, book seats, and manage bookings
- **Admins** — create/manage events, approve or reject paid bookings via the admin dashboard
- **Everyone** — use Google Sign-In when configured

No payment gateway is integrated — paid events simply require admin approval before a booking is confirmed.

---

## 2. Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18, Vite, React Router v6, Axios          |
| Backend    | Vercel Serverless Functions (Node.js)           |
| Database   | MongoDB Atlas (Mongoose ODM)                    |
| Auth       | JWT (jsonwebtoken) + Google OAuth (optional)    |
| Email      | Nodemailer (Gmail SMTP) with console fallback   |
| Hosting    | Vercel (single deployment, one domain)          |

---

## 3. Folder Structure

```
project-root/
│
├── api/                        # Backend — Vercel serverless functions
│   ├── auth/
│   │   ├── register.js         POST /api/auth/register
│   │   ├── verify-otp.js       POST /api/auth/verify-otp
│   │   ├── login.js            POST /api/auth/login
│   │   ├── google.js           POST /api/auth/google
│   │   ├── forgot-password.js  POST /api/auth/forgot-password
│   │   ├── verify-reset-otp.js POST /api/auth/verify-reset-otp
│   │   ├── reset-password.js   POST /api/auth/reset-password
│   │   └── profile.js          GET|PUT /api/auth/profile
│   │
│   ├── events/
│   │   ├── index.js            GET /api/events (public list)
│   │   │                       POST /api/events (admin create)
│   │   ├── [id].js             GET|PUT|DELETE /api/events/:id
│   │   ├── getAll.js           GET /api/events/getAll (alias)
│   │   ├── create.js           POST /api/events/create (alias)
│   │   ├── register.js         POST /api/events/register (book event)
│   │   └── admin/
│   │       ├── all.js          GET /api/events/admin/all
│   │       └── [id]/
│   │           └── status.js   PATCH /api/events/admin/:id/status
│   │
│   ├── bookings/
│   │   ├── index.js            POST /api/bookings (create booking)
│   │   ├── my.js               GET /api/bookings/my
│   │   ├── [id]/
│   │   │   └── cancel.js       PATCH /api/bookings/:id/cancel
│   │   └── admin/
│   │       ├── all.js          GET /api/bookings/admin/all
│   │       └── [id]/
│   │           └── status.js   PATCH /api/bookings/admin/:id/status
│   │
│   ├── users/
│   │   └── profile.js          GET|PUT /api/users/profile (alias)
│   │
│   └── health.js               GET /api/health
│
├── lib/                        # Shared backend logic (imported by api/ functions)
│   ├── db.js                   MongoDB cached connection
│   ├── auth.js                 JWT helpers + serverless auth wrappers
│   ├── models/
│   │   ├── User.js
│   │   ├── Event.js
│   │   └── Booking.js
│   └── utils/
│       ├── apiError.js
│       ├── sendEmail.js
│       ├── generateOTP.js
│       └── fileToDataUri.js
│
├── client/                     # Frontend — React/Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── services/
│   │       └── api.js          Axios instance — uses /api (same Vercel domain)
│   ├── vite.config.js
│   └── package.json
│
├── .env.example                Root environment variable template
├── vercel.json                 Vercel deployment configuration
├── package.json                Root dependencies for serverless functions
└── README.md
```

---

## 4. Local Setup

### Prerequisites

- Node.js ≥ 18
- A [MongoDB Atlas](https://cloud.mongodb.com) cluster (free tier works)
- [Vercel CLI](https://vercel.com/docs/cli) installed globally: `npm i -g vercel`

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/eventsphere.git
cd eventsphere

# 2. Install root (serverless) dependencies
npm install

# 3. Install frontend dependencies
npm run install:client

# 4. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your real values (see section 5 below)

# 5. Start local development (frontend + serverless functions together)
vercel dev
# Frontend → http://localhost:5173
# API      → http://localhost:3000/api
```

> **Tip:** `vercel dev` runs the Vite dev server and the serverless functions in one command — no separate backend process needed.

---

## 5. Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Random secret for signing JWTs |
| `JWT_EXPIRE` | Yes | JWT lifetime, e.g. `7d` |
| `EMAIL_HOST` | No* | SMTP hostname (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | No* | SMTP port (587 for TLS) |
| `EMAIL_USER` | No* | Your Gmail address |
| `EMAIL_PASS` | No* | Gmail **App Password** (not your login password) |
| `OTP_CONSOLE_FALLBACK` | No | Set `true` to print OTPs to console instead of emailing |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID (enables Google Sign-In) |
| `ADMIN_EMAIL` | No | Seed admin email on first boot |
| `ADMIN_PASSWORD` | No | Seed admin password — **change before deploying** |
| `VITE_API_BASE_URL` | No | Leave as `/api` for Vercel; override for local-only dev |
| `VITE_GOOGLE_CLIENT_ID` | No | Same as `GOOGLE_CLIENT_ID` — used by the React app |

\* Email variables are optional if `OTP_CONSOLE_FALLBACK=true` is set (OTPs will appear in the Vercel function logs).

---

## 6. Deployment Steps (Vercel)

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "feat: Vercel-ready serverless conversion"
git push origin main
```

### Step 2 — Import project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** and select your repo

### Step 3 — Configure project settings

Vercel auto-detects settings from `vercel.json`. Confirm:

- **Framework Preset:** Other
- **Root Directory:** `.` (project root, not `client/`)
- **Build Command:** `cd client && npm install && npm run build`
- **Output Directory:** `client/dist`

### Step 4 — Add environment variables

In **Vercel → Project → Settings → Environment Variables**, add all variables from your `.env` file (except `VITE_API_BASE_URL` — leave that as `/api`).

### Step 5 — Deploy

Click **Deploy**. Vercel will:
1. Install root dependencies (`npm install`)
2. Build the React frontend (`cd client && npm run build`)
3. Deploy `api/` as serverless functions
4. Serve `client/dist` as static files

### Step 6 — Verify deployment

```
https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "OK",
  "message": "EventSphere API is running",
  "database": { "connected": true }
}
```

---

## 7. Google Auth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Set **Authorised JavaScript origins:**
   ```
   https://your-app.vercel.app
   http://localhost:5173
   ```
4. Set **Authorised redirect URIs:**
   ```
   https://your-app.vercel.app/api/auth/google
   http://localhost:3000/api/auth/google
   ```
5. Copy the Client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in Vercel env vars.

> **IMPORTANT:** After every domain change, update the Google Cloud Console redirect URIs.
> localhost URLs will break Google login in production.

---

## 8. API Endpoints

All routes are prefixed with `/api`. Frontend calls use relative `/api/...` — no hardcoded localhost URLs.

### Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | Public | Create account, send OTP |
| POST | `/api/auth/verify-otp` | Public | Verify email OTP → receive JWT |
| POST | `/api/auth/login` | Public | Email + password login |
| POST | `/api/auth/google` | Public | Google OAuth sign-in |
| POST | `/api/auth/forgot-password` | Public | Send password reset OTP |
| POST | `/api/auth/verify-reset-otp` | Public | Verify reset OTP |
| POST | `/api/auth/reset-password` | Public | Set new password |
| GET | `/api/auth/profile` | User | Get own profile |
| PUT | `/api/auth/profile` | User | Update name, phone, avatar |

### Events

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/events` | Public | List active events (paginated, filterable) |
| GET | `/api/events/:id` | Public | Get single event details |
| POST | `/api/events` | Admin | Create event |
| PUT | `/api/events/:id` | Admin | Update event |
| DELETE | `/api/events/:id` | Admin | Delete event + bookings |
| GET | `/api/events/admin/all` | Admin | List all events (incl. inactive) |
| PATCH | `/api/events/admin/:id/status` | Admin | Toggle event status |

### Bookings

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/bookings` | User | Book an event |
| GET | `/api/bookings/my` | User | Get own bookings |
| PATCH | `/api/bookings/:id/cancel` | User | Cancel a booking |
| GET | `/api/bookings/admin/all` | Admin | List all bookings |
| PATCH | `/api/bookings/admin/:id/status` | Admin | Approve or reject a booking |

### System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | Public | API + DB health check |

---

## 9. Future Improvements

- **File storage:** Move avatar/event images to Cloudinary or AWS S3 instead of base64 in MongoDB
- **Email templates:** Use a proper HTML email template library (e.g. MJML) for better-looking emails
- **Rate limiting:** Add per-IP rate limiting to auth endpoints using Upstash Redis
- **Search:** Implement full-text search with MongoDB Atlas Search
- **Notifications:** Real-time booking status updates with WebSockets or Server-Sent Events
- **Tests:** Add API integration tests with Jest + Supertest
- **Admin analytics:** Dashboard with event stats, booking trends, and revenue reports
- **Social sharing:** Share event links with Open Graph meta tags
