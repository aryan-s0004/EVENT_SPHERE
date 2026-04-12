DAY 5 — OTP SYSTEM & EMAIL DELIVERY
===================================

Objective
---------
Build a reliable OTP-based email verification and password-reset flow. Handle the challenge of sending transactional emails from a serverless environment where traditional SMTP is often blocked.

Features Implemented
--------------------
- 6-digit cryptographically random OTP generated with `crypto.randomInt`
- OTP stored in user document with 10-minute expiry
- 1-minute resend cooldown to prevent spam
- Three-tier email delivery: Resend API → SMTP → Console fallback
- Signup OTP flow: register → verify OTP → account activated
- Password reset flow: forgot-password → verify reset OTP → new password
- OTP cleared from DB after successful verification (no replay attacks)
- Roll-back on email failure: user record deleted if created and email fails

OTP Flow Diagrams
-----------------

  Signup Verification
```
POST /auth/register
  → validate input (Zod)
  → check if email already verified (conflict)
  → check resend cooldown (429 if within 1 min)
  → generate 6-digit OTP
  → set otpExpiry = now + 10 min
  → save user (unverified)
  → send email (Resend / SMTP / console)
  → if email fails → delete user → re-throw error
  → return { userId, resendAvailableInSeconds: 60 }

POST /auth/verify-otp
  → find user by userId or email
  → check OTP match
  → check OTP not expired
  → set isVerified = true, clear OTP fields
  → return JWT + user object
```

  Password Reset
```
POST /auth/forgot-password
  → find user by email (404 if not found)
  → check reset OTP resend cooldown
  → generate 6-digit reset OTP
  → save resetOtp + resetOtpExpiry
  → send email

POST /auth/verify-reset-otp
  → validate OTP
  → set resetOtpVerifiedAt = now

POST /auth/reset-password
  → check OTP not expired
  → check OTP was verified (resetOtpVerifiedAt exists)
  → set new password (pre-save hook hashes it)
  → clear all reset OTP fields
```

Email Delivery Architecture
---------------------------

  Three-Tier Fallback
```
sendEmail()
  │
  ├─ 1. RESEND_API_KEY set?
  │     → HTTP POST to Resend API (works on Vercel, no SMTP needed)
  │     → Success → return { via: 'resend' }
  │     → Fail    → fall through to SMTP
  │
  ├─ 2. SMTP configured? (EMAIL_HOST + EMAIL_USER + EMAIL_PASS)
  │     → Nodemailer on port 465 (SSL) — port 587 blocked by AWS/Vercel
  │     → Success → return { via: 'smtp' }
  │     → EAUTH   → if fallback enabled → console, else throw EMAIL_AUTH_FAILED
  │     → Other   → if fallback enabled → console, else throw EMAIL_FAILED
  │
  └─ 3. OTP_CONSOLE_FALLBACK=true?
        → console.warn OTP visible in Vercel function logs
        → return { delivered: false, fallback: true, via: 'console' }
        → else throw EMAIL_SERVICE_UNAVAILABLE
```

  Why Resend over plain SMTP on Vercel?
Gmail SMTP (ports 587 and 465) is often blocked by AWS, which hosts Vercel functions. Resend uses an HTTPS API call — no TCP socket to port 25/465/587 — so it works reliably from any serverless environment.

Key Files
---------
| File | Purpose |
| `backend/utils/send-email.js` | Three-tier email sender (Resend / SMTP / console) |
| `backend/utils/generate-otp.js` | `crypto.randomInt(100000, 999999)` — no Math.random |
| `backend/services/auth-service.js` | OTP generation, storage, verification, expiry logic |

Environment Variables
---------------------
| Variable | Required | Description |
| `EMAIL_HOST` | For SMTP | `smtp.gmail.com` |
| `EMAIL_PORT` | For SMTP | `465` (SSL) — not 587 on Vercel |
| `EMAIL_USER` | For SMTP | Gmail address |
| `EMAIL_PASS` | For SMTP | Gmail App Password (16 chars) |
| `RESEND_API_KEY` | Recommended | From resend.com — enables reliable delivery |
| `OTP_CONSOLE_FALLBACK` | Dev only | `true` → OTP printed to server logs |

Security Considerations
-----------------------
| Concern | Mitigation |
| OTP brute force | 10 req/15 min rate limit; OTP expires in 10 min |
| OTP replay | OTP fields cleared immediately after successful verify |
| Email enumeration | `forgot-password` returns 404 if email not found (intentional — debatable; can be changed to always-200 for privacy) |
| OTP in logs | Console fallback for dev only; production should use Resend |

Challenges & Solutions
----------------------
| Challenge | Solution |
| Gmail SMTP blocked on Vercel (AWS IP range) | Switched to port 465; added Resend API as primary delivery |
| Email sends but OTP not reaching inbox | Resend requires domain verification for custom from-address; use `onboarding@resend.dev` for free tier |
| Transporter reuse across warm Lambda invocations | Module-level `let transporter = null` singleton; reset to `null` on error |

Output
------
- Registration OTP flow works end-to-end
- Password reset flow works end-to-end
- OTPs visible in Vercel function logs when console fallback active
- To enable real email: add `RESEND_API_KEY` to Vercel env vars
