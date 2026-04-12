DAY 2 — AUTHENTICATION SYSTEM
=============================

Objective
---------
Build a complete, production-grade authentication system: user registration with email OTP verification, login with JWT, and protected route middleware. No third-party OAuth — pure email/password.

Features Implemented
--------------------
- User registration → OTP email → email verification → account activated
- Login with bcrypt password comparison → JWT issued
- JWT `protect` middleware for all private routes
- `adminOnly` middleware for admin-restricted routes
- OTP cooldown (1 min resend lock) + OTP expiry (10 min)
- Zod schema validation on every auth request
- Per-IP rate limiting on all auth endpoints (10 req / 15 min in dev)
- Roll-back logic: if email send fails after user creation, user record is deleted

Technical Approach
------------------

  Why JWT over sessions?
- Stateless — no server-side session store needed (critical for serverless)
- Token carries `{ id, role }` — single DB lookup eliminated on protected routes
- 7-day expiry with `JWT_EXPIRE` env var; auto-logout on 401 `TOKEN_*` errors

  Why bcrypt with cost factor 10?
- 10 rounds = ~100ms hash time — slow enough to defeat brute force, fast enough for UX
- Handled in Mongoose `pre('save')` hook — password is always hashed before write, impossible to store plaintext accidentally

  Why OTP over magic links?
- OTPs work without a custom domain for email links
- 6-digit numeric OTP is mobile-friendly (can be auto-filled by SMS/email clients)
- Stored hashed? No — OTPs expire in 10 min and are cleared after use, so plain storage is acceptable

  Why Zod for validation?
- TypeScript-native schema definitions that work in plain JS
- `safeParse` returns structured errors — no try/catch needed
- Strips unknown fields automatically (prevents parameter pollution)

Key Files
---------
| File | Purpose |
| `backend/models/user.js` | User schema + pre-save bcrypt hook + `matchPassword()` |
| `backend/services/auth-service.js` | All auth business logic |
| `backend/controllers/auth-controller.js` | Thin HTTP handlers |
| `backend/api/auth-routes.js` | Route definitions + middleware chain |
| `backend/validators/auth-validators.js` | Zod schemas for all auth endpoints |
| `backend/middleware/auth-middleware.js` | `protect` + `adminOnly` middleware |
| `backend/utils/generate-otp.js` | Cryptographically random 6-digit OTP |
| `backend/utils/send-email.js` | Nodemailer / Resend email sender |

User Model Schema
-----------------
```js
{
  name, email, password,        // core fields
  role: 'user' | 'admin',
  isVerified: Boolean,
  avatar, phone,                // profile extras
  otp, otpExpiry, otpLastSentAt,           // signup OTP
  resetOtp, resetOtpExpiry,                // password reset OTP
  resetOtpLastSentAt, resetOtpVerifiedAt,
}
```

API Endpoints
-------------
| Method | Path | Auth | Description |
| POST | `/api/auth/register` | Public | Create unverified user, send OTP |
| POST | `/api/auth/verify-otp` | Public | Verify OTP → activate account, return JWT |
| POST | `/api/auth/login` | Public | Email + password → JWT |
| POST | `/api/auth/forgot-password` | Public | Send reset OTP to email |
| POST | `/api/auth/verify-reset-otp` | Public | Validate reset OTP |
| POST | `/api/auth/reset-password` | Public | Set new password (after OTP verified) |
| GET | `/api/auth/profile` | JWT | Get current user profile |
| PUT | `/api/auth/profile` | JWT | Update name / phone / avatar |

Request / Response Samples
--------------------------

POST /api/auth/register
```json
// Request
{ "name": "Aryan", "email": "aryan@example.com", "password": "MyPass123" }

// Response 200
{
  "success": true,
  "message": "OTP sent to your email",
  "userId": "69d6a0c7...",
  "deliveryMethod": "email",
  "resendAvailableInSeconds": 60,
  "expiresInSeconds": 600
}
```

POST /api/auth/login
```json
// Request
{ "email": "aryan@example.com", "password": "MyPass123" }

// Response 200
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": "...", "name": "Aryan", "email": "...", "role": "user", "isVerified": true }
}
```

Challenges & Solutions
----------------------
| Challenge | Solution |
| Double-hashing when seed updates admin password | Let Mongoose pre-save hook hash — never pre-hash before `.save()` |
| Email fails after user created → orphan record | Try email first in a transaction-like pattern; delete user on failure |
| OTP brute-force | 10 req/15 min rate limit + OTP expires in 10 min |
| Vercel blocks Gmail SMTP port 587 | Switched to port 465 (SSL); added Resend HTTP API as primary delivery |

Output
------
- Full register → OTP verify → login flow working end-to-end
- Admin login: `aryancoder999@gmail.com` / `Admin@EventSphere1!`
- JWT stored in localStorage, injected via Axios request interceptor
