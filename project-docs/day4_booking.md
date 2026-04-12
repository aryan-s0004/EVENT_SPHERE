# Day 4 — Booking System

## Objective
Implement the full booking lifecycle: users book events (up to 10 seats), admin approves or rejects paid-event bookings, free-event bookings are auto-approved, and users can cancel their own bookings.

---

## Features Implemented
- Users can book 1–10 seats per event
- Free events: booking auto-approved on creation
- Paid events: booking starts as `pending`, requires admin approval
- Admin approve / reject via dashboard (with seat count adjustment)
- Users can cancel `pending` or `approved` bookings (seats returned to pool)
- User "My Bookings" page showing all bookings with status and event details
- Admin "Bookings" tab showing all bookings across all users
- Booking timestamps: `createdAt`, `processedAt`, `processedBy`

---

## Technical Approach

### Why two-state approval for paid events?
- Prevents double-booking when seat counts change between book and approval
- Gives admin control over who attends capacity-limited paid events
- Mirrors real-world ticketing systems (hold → confirm → paid)

### Seat atomicity concern
In a high-concurrency scenario, two simultaneous booking requests could both read `availableSeats = 1` and both succeed, resulting in overbooking. Mitigations:
- MongoDB `findOneAndUpdate` with `$inc` is atomic at the document level
- Future improvement: use MongoDB transactions for strict consistency

### Why allow cancellation of approved bookings?
- UX: users should not be permanently locked into bookings
- Seats are returned to `availableSeats` on cancellation — inventory stays accurate
- Admin cancelled-by-admin flow is a future feature (see `project-docs/final_summary.md`)

---

## Key Files
| File | Purpose |
|---|---|
| `backend/models/booking.js` | Booking schema with compound unique index |
| `backend/services/booking-service.js` | bookEvent, getUserBookings, cancelBooking, processBooking |
| `backend/controllers/booking-controller.js` | HTTP handlers |
| `backend/api/booking-routes.js` | Routes with user + admin guards |
| `frontend/src/pages/MyBookings.jsx` | User booking history page |
| `frontend/src/pages/AdminDashboard.jsx` | Admin booking approval UI |

---

## Booking Schema
```js
{
  user:        ObjectId → User,
  event:       ObjectId → Event,
  seats:       Number (1–10),
  totalPrice:  Number (seats × event.price),
  status:      'pending' | 'approved' | 'rejected' | 'cancelled',
  processedAt: Date,    // when admin approved/rejected
  processedBy: ObjectId → User (admin),
}
```

**Unique constraint:** one active booking per user per event (`{ user, event, status: { $in: ['pending', 'approved'] } }`)

---

## API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | User | Book an event |
| GET | `/api/bookings/mine` | User | Get own bookings |
| PATCH | `/api/bookings/:id/cancel` | User | Cancel own booking |
| GET | `/api/bookings/admin/all` | Admin | All bookings across all users |
| PATCH | `/api/bookings/admin/:id/process` | Admin | Approve or reject booking |

---

## Request / Response Samples

**POST /api/bookings**
```json
// Request (Authorization: Bearer <token>)
{ "eventId": "69d6b766...", "seats": 2 }

// Response 201 (free event — auto approved)
{
  "success": true,
  "booking": {
    "_id": "...",
    "status": "approved",
    "seats": 2,
    "totalPrice": 0
  }
}

// Response 201 (paid event — pending)
{
  "success": true,
  "booking": {
    "_id": "...",
    "status": "pending",
    "seats": 2,
    "totalPrice": 1000
  }
}
```

**PATCH /api/bookings/admin/:id/process**
```json
// Request (Authorization: Bearer <admin-token>)
{ "status": "approved" }

// Response 200
{
  "success": true,
  "booking": { "_id": "...", "status": "approved", "processedAt": "2026-04-12T..." },
  "event": { "id": "...", "availableSeats": 148 },
  "message": "Booking approved"
}
```

---

## Status Flow
```
Book free event  →  approved  (instant)
Book paid event  →  pending  →  approved / rejected  (admin action)
Any booking      →  cancelled  (user action, seats returned)
```

---

## Challenges & Solutions
| Challenge | Solution |
|---|---|
| Frontend called `/bookings/admin/:id/status` (wrong URL) | Fixed to `/bookings/admin/:id/process` to match backend route |
| Admin dashboard polled every 5s causing unnecessary requests | Removed `setInterval`; data refreshes only after each admin action |
| Double-booking risk on free events | `findOne` check before insert; unique compound index as DB-level guard |

---

## Output
- Booking approve/reject works end-to-end in admin dashboard
- "My Bookings" page displays correct status badges for each booking
- Seat counts update correctly after approval or cancellation
