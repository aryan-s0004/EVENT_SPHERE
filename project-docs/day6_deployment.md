DAY 6 — PRODUCTION DEPLOYMENT
=============================

Objective
---------
Deploy the full MERN application to a single Vercel project — React SPA served as static files, Express API served as serverless functions — with zero separate hosting required.

Architecture: Unified Vercel Deployment
---------------------------------------

```
Browser
  │
  ├─ GET /                  → Vercel CDN → frontend/dist/index.html (React SPA)
  ├─ GET /events            → Vercel CDN → index.html (client-side route)
  ├─ GET /api/*             → Vercel Serverless → api/index.js → Express
  └─ GET /assets/*          → Vercel CDN → frontend/dist/assets/
```

  Why Vercel over Render for this project?
| Factor | Vercel | Render |
| Frontend hosting | Built-in CDN | Separate static service |
| Cold start | ~200ms | ~500ms (free tier) |
| HTTPS | Automatic | Automatic |
| Price (free tier) | 100 GB bandwidth | 750 hrs/month |
| Deploys from Git | Yes (auto) | Yes (auto) |

Decision: Vercel hosts both frontend and backend in a single project using the monorepo pattern — simpler config, one URL, no CORS issues in production (same origin).

vercel.json Explained
---------------------
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": null,
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```
- `framework: null` — prevents Vercel auto-detecting "vite" and running its own build
- First rewrite: all `/api/*` traffic → single Express serverless function
- Second rewrite: all non-API routes → `index.html` (enables React client-side routing)

api/index.js — Serverless Entry Point
-------------------------------------
```js
require('dotenv').config();
const { connectDB } = require('../backend/db/index');
const createApp     = require('../backend/app');

const app = createApp();  // Express app factory (not singleton)

module.exports = async (req, res) => {
  await connectDB();  // uses cached connection across warm invocations
  return app(req, res);
};
```
- `connectDB()` called on every request but returns cached Mongoose connection
- App factory pattern (`createApp()`) avoids global state issues in serverless

Deployment Steps
----------------

  First-time setup
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project (run from project root)
vercel link

# 3. Add environment variables
vercel env add MONGO_URI production
vercel env add JWT_SECRET production
vercel env add JWT_EXPIRE production      # e.g. 7d
vercel env add EMAIL_HOST production      # smtp.gmail.com
vercel env add EMAIL_PORT production      # 465
vercel env add EMAIL_USER production      # your Gmail
vercel env add EMAIL_PASS production      # 16-char App Password
vercel env add OTP_CONSOLE_FALLBACK production  # false (or true for testing)
vercel env add ADMIN_EMAIL production
vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_NAME production
vercel env add SEED_SECRET production     # any random string

# 4. Deploy to production
vercel --prod --yes
```

  Subsequent deploys
```bash
# Auto-deploy: just push to main branch (if connected to GitHub)
git push origin main

# Manual force deploy
vercel --prod --yes
```

Environment Variables Reference
-------------------------------
| Variable | Example | Required | Notes |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/EVENTSPHERE` | Yes | DB name must match exactly (case-sensitive) |
| `JWT_SECRET` | 64-char hex string | Yes | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRE` | `7d` | Yes | |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP only | |
| `EMAIL_PORT` | `465` | SMTP only | Use 465 (SSL) not 587 on Vercel |
| `EMAIL_USER` | `you@gmail.com` | SMTP only | |
| `EMAIL_PASS` | `abcd efgh ijkl mnop` | SMTP only | Gmail App Password |
| `RESEND_API_KEY` | `re_xxx` | Recommended | Replaces SMTP; more reliable on Vercel |
| `OTP_CONSOLE_FALLBACK` | `false` | No | Set `true` only for testing |
| `ADMIN_EMAIL` | `admin@eventsphere.com` | Yes | Used by `/api/seed` |
| `ADMIN_PASSWORD` | `Admin@1234!` | Yes | Used by `/api/seed` |
| `SEED_SECRET` | `any-random-string` | Yes | Header required to call `/api/seed` |

Seeding the Database (First Deploy)
-----------------------------------
```bash
# Call the seed endpoint once after first deploy
curl -X POST https://your-project.vercel.app/api/seed \
  -H "x-seed-secret: your-SEED_SECRET-value"

# This creates:
# - Admin account (from ADMIN_EMAIL + ADMIN_PASSWORD env vars)
# - 8 sample events across all categories
```

Common Errors & Fixes
---------------------
| Error | Cause | Fix |
| `db already exists with different case` | MONGO_URI has wrong DB name casing | Change to `EVENTSPHERE` (uppercase) to match Atlas |
| `app.use() requires a middleware function` | Importing whole module instead of named export | `const { errorHandler } = require('./error-middleware')` |
| `FUNCTION_INVOCATION_FAILED` | Crash inside serverless function | Check Vercel logs: Project → Functions → Expand logs |
| `Login.jsx syntax error` | Stray property in styles object | Remove stray lines from `const styles = {...}` |
| `EMAIL_FAILED` on Vercel | Port 587 blocked by AWS | Switch to port 465 or use Resend API |
| `404 on /api/events` | Vercel rewrite not matching | Ensure `vercel.json` rewrite source is `/api/(.*)` |

Live URLs
---------
- Production: https://eventosphere.vercel.app
- Health check: https://eventosphere.vercel.app/api/health
- Vercel dashboard: https://vercel.com/aryan-sahus-projects-4ade9def/eventosphere

Output
------
- Single Vercel project hosts both React SPA and Express API
- Auto-deploys on every push to `main` branch
- HTTPS, CDN, and serverless scaling included automatically
