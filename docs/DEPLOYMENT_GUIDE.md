# EventSphere — Deployment Guide

## Deployment Targets

The EventSphere application is built for a **Unified Vercel Deployment**. This means both the React frontend and the Express API are hosted on Vercel under a single domain.

| Component | Platform | Entry point |
|---|---|---|
| Unified Full-Stack | **Vercel** | `api/index.js` (Backend) + `frontend/dist` (Frontend) |

---


## 1 — Vercel Deployment (Recommended)

### Prerequisites

- Vercel account (free or Pro)
- MongoDB Atlas cluster (M0 free or M10+ for production)
- Node.js ≥ 18

### Step-by-step

#### 1.1 Connect repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework Preset → **Other** (do NOT select Vite — `framework: null` in vercel.json handles this)

#### 1.2 Build & output settings

Vercel reads these from `vercel.json` automatically:

```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "installCommand": "npm install"
}
```

No manual configuration needed.

#### 1.3 Environment variables

Set these in **Vercel Project Settings → Environment Variables**:

| Variable | Required | Example |
|---|---|---|
| `MONGO_URI` | ✅ | `mongodb+srv://user:pass@cluster.mongodb.net/eventsphere` |
| `JWT_SECRET` | ✅ | 64-char random string (`openssl rand -hex 32`) |
| `JWT_EXPIRE` | ✅ | `7d` |
| `EMAIL_HOST` | ⚠ | `smtp.gmail.com` |
| `EMAIL_PORT` | ⚠ | `587` |
| `EMAIL_USER` | ⚠ | `you@gmail.com` |
| `EMAIL_PASS` | ⚠ | App password (not account password) |
| `GOOGLE_CLIENT_ID` | ⚠ | `123...apps.googleusercontent.com` |
| `VITE_API_BASE_URL` | ✅ | `/api` |
| `VITE_GOOGLE_CLIENT_ID` | ⚠ | Same as `GOOGLE_CLIENT_ID` |

> ⚠ = Optional but disables the feature if unset.

#### 1.4 Deploy

```bash
vercel --prod   # or push to main branch (auto-deploy)
```

#### 1.5 Verify

```bash
curl https://your-project.vercel.app/api/health
# → {"success":true,"status":"ok","timestamp":"..."}
```

---

## 2 — Express Server Deployment (Render / Railway)

Use this path when you need persistent connections, WebSockets, or background workers.

### Render

1. New → **Web Service** → Connect GitHub repo
2. Root Directory: `server`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Environment: **Node**

Set the same environment variables as above, plus:

| Variable | Value |
|---|---|
| `PORT` | (Render sets this automatically) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://your-project.vercel.app` |

### Railway

```bash
railway up --service eventsphere-server
railway variables set MONGO_URI=... JWT_SECRET=... ...
```

---

## 3 — Local Development

### Option A — Vercel Dev (full serverless emulation)

```bash
# From project root
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
vercel dev             # runs on http://localhost:3000
```

In `client/vite.config.js` set proxy target to `http://localhost:3000`.

### Option B — Express Dev Server

```bash
# Terminal 1 — backend
cd server
npm install
cp ../.env.example ../.env
npm run dev            # nodemon, port 5000

# Terminal 2 — frontend
cd client
npm install
npm run dev            # Vite on port 5173, proxies /api → 5000
```

The default proxy in `client/vite.config.js` targets `http://localhost:5000`.

---

## 4 — Google OAuth Setup (Phase 6 Audit)

### 4.1 Create OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create **OAuth 2.0 Client ID** → Application type: **Web application**

### 4.2 Authorised JavaScript origins

Add all origins where the login button is rendered:

| Environment | URI |
|---|---|
| Production | `https://your-project.vercel.app` |
| Preview (Vercel) | `https://your-project-git-*.vercel.app` |
| Local dev | `http://localhost:5173` |

> **Critical:** These must be exact — no trailing slash, no wildcards.

### 4.3 Authorised redirect URIs

EventSphere uses the **implicit / credential response** flow (Google Identity Services JS SDK),
so no redirect URI is required for the frontend sign-in.

For server-side verification only the **Client ID** is needed — the library validates the `aud` claim
in the ID token against `process.env.GOOGLE_CLIENT_ID`.

### 4.4 Environment checklist

```bash
# Server (.env)
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com

# Client (.env)
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

Both values **must match exactly**.

### 4.5 Common errors

| Error | Cause | Fix |
|---|---|---|
| `idpiframe_initialization_failed` | Origin not in allowed list | Add origin in GCP console |
| `popup_closed_by_user` | Popup blocked by browser | Allow popups for the domain |
| `invalid_client` | Client ID mismatch | Verify VITE_ and server vars are equal |
| `Token used too late` | Server clock drift | Sync server time (NTP) |

---

## 5 — Admin Seeding

The database does not ship with an admin user. Create one after first deploy:

```bash
# One-time admin seed (run from project root)
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./lib/models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const existing = await User.findOne({ email: 'admin@eventsphere.com' });
  if (existing) { console.log('Admin already exists'); process.exit(0); }

  await User.create({
    name:       'Admin',
    email:      'admin@eventsphere.com',
    password:   'Admin@1234',   // change immediately after login
    role:       'admin',
    isVerified: true,
  });
  console.log('Admin user created: admin@eventsphere.com / Admin@1234');
  process.exit(0);
}).catch(console.error);
"
```

> Change the password immediately after first login.

---

## 6 — MongoDB Atlas Configuration

### Recommended indexes

Run once after the cluster is provisioned:

```javascript
// In mongosh or Atlas Data Explorer
db.events.createIndex({ status: 1, date: 1, category: 1 });
db.events.createIndex({ title: 'text', location: 'text' });  // for search

db.bookings.createIndex({ user: 1, createdAt: -1 });
db.bookings.createIndex(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'approved'] } } }
); // prevents duplicate active bookings

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { sparse: true });
```

### Network access

- Add Vercel's IP ranges (or allow `0.0.0.0/0` for Vercel serverless, as IPs are dynamic)
- For Render/Railway: add the static outbound IP of your service

---

## 7 — Post-Deploy Checklist

```
[ ] GET /api/health returns 200
[ ] User registration sends OTP email
[ ] OTP verification returns JWT
[ ] Google Sign-In works on production domain
[ ] Admin can create / edit / delete events
[ ] User can book a free event (instant approval)
[ ] User can book a paid event (pending → admin approves)
[ ] Admin receives booking in /admin/bookings
[ ] Booking approval sends confirmation email
[ ] Booking cancellation restores seat count
[ ] Rate limiter returns 429 after >10 auth requests in 15 min
[ ] HTTPS enforced (Vercel provides this automatically)
[ ] JWT_SECRET is not the default placeholder
```
