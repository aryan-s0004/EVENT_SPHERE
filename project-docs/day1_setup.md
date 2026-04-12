DAY 1 — PROJECT SETUP & ARCHITECTURE DESIGN
===========================================

Objective
---------
Establish the full project skeleton: folder structure, tooling, environment configuration, and MongoDB Atlas connection. Define the MVC + Service Layer pattern that every feature would follow.

Features Implemented
--------------------
- Project scaffolded with `frontend/` (React 18 + Vite) and `backend/` (Express) separation
- Root `package.json` with workspace scripts (`dev:backend`, `dev:frontend`, `install:all`)
- MongoDB Atlas cluster connected via Mongoose with connection caching for serverless
- Environment variable validation on server start (fail-fast pattern)
- Winston structured logger configured (JSON in production, pretty-print in dev)
- Vercel `api/index.js` serverless entry point wired to Express app

Technical Approach
------------------

  Why MVC + Service Layer?
A pure MVC pattern puts business logic in controllers, making them hard to test and reuse. Adding a Service Layer between controllers and models means:
- Controllers only extract request fields and shape HTTP responses
- Services hold all domain logic (OTP expiry, seat counts, auth checks)
- Models define schema and DB queries
- Each layer is independently testable

  Why MongoDB Atlas?
- Fully managed — no provisioning or patching
- Free M0 tier sufficient for development and demo
- Native Mongoose ODM with schema validation
- Works from any host (Vercel, Render, local)

  Why Vite over CRA?
- 10–50× faster cold starts (ESM-native dev server)
- HMR (Hot Module Replacement) is near-instant
- Smaller production bundles with better tree-shaking
- Proxies `/api/*` to Express during local development via `vite.config.js`

Key Files Created
-----------------
| File | Purpose |
| `backend/app.js` | Express app factory (not singleton — avoids serverless state issues) |
| `backend/db/index.js` | Mongoose connect with connection caching |
| `backend/db/env.js` | Required env var validation on startup |
| `backend/utils/logger.js` | Winston logger (JSON prod / pretty dev) |
| `api/index.js` | Vercel serverless entry point |
| `vercel.json` | Build config + API rewrites |
| `frontend/vite.config.js` | Dev proxy + React plugin |

API Endpoints Created
---------------------
| Method | Path | Description |
| GET | `/api/health` | Server health check |

Challenges & Solutions
----------------------
| Challenge | Solution |
| Mongoose throws on repeated `model()` calls in serverless hot-reload | `mongoose.models.User \|\| mongoose.model('User', schema)` guard |
| `process.exit(1)` crashes entire Vercel function | Throw error instead; next invocation gets a fresh cold start |
| Local dev needs `/api` proxy to Express | Vite `server.proxy` in `vite.config.js` |

Output
------
- `GET /api/health` returns `{ success: true, status: "ok", timestamp: "..." }`
- MongoDB connection established and cached across warm invocations
- Both `npm run dev:backend` and `npm run dev:frontend` run independently
