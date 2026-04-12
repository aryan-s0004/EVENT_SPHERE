TESTING & PERFORMANCE REPORT
============================

API Testing — Postman Collection
--------------------------------

  Base URL
```
Production: https://eventosphere.vercel.app
Local: http://localhost:5000
```

  Environment Variables (Postman)
```
baseUrl    = https://eventosphere.vercel.app
token      = (set after login)
adminToken = (set after admin login)
userId     = (returned from register)
bookingId  = (returned from book event)
eventId    = (returned from events list)
```

Test Cases — Auth Endpoints
---------------------------

  1. Health Check
```
GET {{baseUrl}}/api/health

Expected: 200
{ "success": true, "status": "ok", "timestamp": "2026-04-12T..." }
```

  2. Register (Step 1)
```
POST {{baseUrl}}/api/auth/register
Content-Type: application/json

{
 "name": "Test User",
 "email": "test@example.com",
 "password": "TestPass123"
}

Expected: 200
{ "success": true, "userId": "...", "deliveryMethod": "email" | "console_fallback" }

Save: userId from response
```

  3. Verify OTP (Step 2)
```
POST {{baseUrl}}/api/auth/verify-otp
Content-Type: application/json

{
 "userId": "{{userId}}",
 "otp": "123456"   <- from email or Vercel logs
}

Expected: 200
{ "success": true, "token": "eyJ...", "user": { "role": "user" } }

Save: token from response
```

  4. Login
```
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{ "email": "test@example.com", "password": "TestPass123" }

Expected: 200 -> { "success": true, "token": "..." }
Error cases:
 Wrong password -> 400 INVALID_CREDENTIALS
 Unverified user -> 403 EMAIL_NOT_VERIFIED
```

  5. Forgot Password
```
POST {{baseUrl}}/api/auth/forgot-password
{ "email": "test@example.com" }
Expected: 200 -> { "userId": "...", "resendAvailableInSeconds": 60 }

POST {{baseUrl}}/api/auth/verify-reset-otp
{ "userId": "...", "otp": "654321" }
Expected: 200 -> { "userId": "..." }

POST {{baseUrl}}/api/auth/reset-password
{ "userId": "...", "newPassword": "NewPass456" }
Expected: 200 -> { "success": true, "message": "Password updated successfully" }
```

Test Cases — Events Endpoints
-----------------------------

  6. List Events (public)
```
GET {{baseUrl}}/api/events?page=1&limit=6&category=Tech

Expected: 200
{ "success": true, "events": [...], "total": N, "page": 1, "pages": P }
```

  7. Single Event
```
GET {{baseUrl}}/api/events/{{eventId}}

Expected: 200 -> { "success": true, "event": { ... } }
Invalid ID -> 400 INVALID_ID
Not found  -> 404 EVENT_NOT_FOUND
```

  8. Admin — Create Event
```
POST {{baseUrl}}/api/events
Authorization: Bearer {{adminToken}}
Content-Type: multipart/form-data

title=TechConf 2026&description=A great tech event...&date=2026-12-01
&time=10:00 AM&location=Bengaluru&category=Tech&totalSeats=100&price=500

Expected: 201 -> { "success": true, "event": { "_id": "...", "status": "active" } }
```

Test Cases — Bookings Endpoints
--------------------------------

  9. Book an Event
```
POST {{baseUrl}}/api/bookings
Authorization: Bearer {{token}}
Content-Type: application/json

{ "eventId": "{{eventId}}", "seats": 2 }

Free event  -> 201, status: "approved"
Paid event  -> 201, status: "pending"
No seats    -> 400 INSUFFICIENT_SEATS
```

  10. Admin Approve/Reject
```
PATCH {{baseUrl}}/api/bookings/admin/{{bookingId}}/process
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{ "status": "approved" } or { "status": "rejected" }

Expected: 200 -> { "success": true, "booking": { "status": "approved" }, "message": "Booking approved" }
```

Error Response Format
---------------------
All errors follow this structure:
```json
{
 "success": false,
 "code": "MACHINE_READABLE_CODE",
 "message": "Human readable message",
 "details": { ... }
}
```

Common error codes:
| Code | HTTP | Meaning |
| VALIDATION_ERROR | 400 | Zod schema validation failed |
| INVALID_CREDENTIALS | 400 | Wrong email or password |
| EMAIL_NOT_VERIFIED | 403 | Account exists but OTP not verified |
| OTP_INVALID | 400 | Wrong OTP entered |
| OTP_EXPIRED | 400 | OTP > 10 minutes old |
| TOKEN_EXPIRED | 401 | JWT expired |
| TOKEN_INVALID | 401 | Malformed or tampered JWT |
| UNAUTHORIZED | 401 | No token provided |
| FORBIDDEN | 403 | Valid token but insufficient role |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| EMAIL_FAILED | 502 | SMTP connection failed |

Performance Observations
------------------------

  Measured Response Times (Vercel Production)

| Endpoint | Cold Start | Warm | Notes |
| GET /api/health | ~280ms | ~45ms | No DB query |
| GET /api/events | ~600ms | ~120ms | DB query + populate |
| POST /api/auth/login | ~800ms | ~200ms | bcrypt compare (10 rounds) |
| POST /api/auth/register | ~1200ms | ~400ms | bcrypt + email send |
| POST /api/bookings | ~750ms | ~180ms | Read + write + seat update |
| PATCH /api/bookings/.../process | ~700ms | ~160ms | Read + aggregate + write |

Cold start = first request after function is idle. Warm = subsequent request within minutes.

  k6 Load Test Configuration
File: tests/k6-load-test.js

```bash
# Smoke test (1 user, 1 minute)
k6 run -e SCENARIO=smoke tests/k6-load-test.js

# Load test (ramp to 50 VUs)
k6 run tests/k6-load-test.js

# Stress test (up to 300 VUs)
k6 run -e SCENARIO=stress tests/k6-load-test.js

# Against production
k6 run -e BASE_URL=https://eventosphere.vercel.app tests/k6-load-test.js
```

  SLO Thresholds
```
p95 response time < 500ms
p99 response time < 1500ms
Error rate < 1%
Auth endpoints p95 < 800ms
Events p95 < 400ms
```

  Bottlenecks Identified
| Bottleneck | Impact | Mitigation |
| bcrypt cost 10 | +100ms on login/register | Intentional — security trade-off |
| MongoDB Atlas M0 (shared) | Higher latency under load | Upgrade to M10+ for production |
| Vercel cold starts | ~600ms first request | Keep-warm via UptimeRobot ping |
| Image stored as base64 in MongoDB | Large documents | Use Cloudinary/S3 in production |
| No DB indexes on otp, email | Slower OTP lookups at scale | email is indexed (unique); otp looked up by userId |

  Optimization Suggestions
1. Add Redis for OTP storage — removes DB writes on every OTP send
2. Cloudinary for event images — reduces MongoDB document size by ~80%
3. Mongoose .lean() already used in getEvents — good practice
4. MongoDB Atlas Search for full-text event search — replaces regex
5. Vercel Edge Functions for /api/health and static data — eliminates cold starts
6. Resend webhooks for delivery status tracking

---

Dashboard Cleanup
-----------------

Removed stat cards: Total Users, Revenue Confirmed (both required optional analytics endpoint).
Remaining cards: Total Events, Active Events, Total Bookings, Pending Approval.
All four cards now derive purely from local events/bookings state — no analytics dependency.

DB Reset Process
----------------

Script: scripts/resetData.js

```bash
cd d:\EVENT_SPHERE
node -r dotenv/config scripts/resetData.js dotenv_config_path=.env
```

What it does:
- Deletes all users where role != "admin"
- Deletes all bookings
- Preserves admin account and all events

Post-reset state: admin login works, events visible, no users, no bookings.

Manual Testing Checklist (Post-Reset)
--------------------------------------

[x] Admin login succeeds
[x] Events tab shows existing events
[x] Bookings tab shows empty state
[x] Create new event via dashboard form
[x] Register new user account (OTP flow)
[x] Book event as user
[x] Approve/reject booking as admin
[x] Cancel booking as user
[x] No console errors in browser DevTools
[x] No extra API calls on dashboard load
