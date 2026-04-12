DAY 3 — EVENT MANAGEMENT SYSTEM
===============================

Objective
---------
Build complete CRUD for events — public browsing with filters/pagination, admin creation/editing, seat tracking, and category-based organisation. All event data stored in MongoDB Atlas `events` collection.

Features Implemented
--------------------
- Public event listing with category filter, text search, and pagination
- Single event detail page with full metadata
- Admin: create event (with image upload as base64 data URI)
- Admin: edit event (validates new seat count against approved bookings)
- Admin: soft toggle active / inactive (inactive events hidden from public)
- Admin: delete event + all associated bookings cascade
- `availableSeats` auto-set to `totalSeats` on creation via Mongoose pre-save hook
- `approvalRequired` auto-derived from price (paid events require admin approval)
- Compound index on `{ status, date }` for fast public listing queries

Technical Approach
------------------

  Why store images as base64 data URIs?
- No external storage service required (no S3, no Cloudinary)
- Works immediately without additional credentials
- Sufficient for event thumbnails at 2 MB limit
- Trade-off: increases document size — acceptable for a portfolio project; production would use Cloudinary

  Why soft-delete (active/inactive) over hard delete?
- Preserves historical booking data integrity
- Admin can reactivate an event if deactivated by mistake
- Hard delete is available separately and cascades bookings

  Why Multer with in-memory storage?
- Files handled in RAM as `Buffer` — no temp file cleanup needed in serverless
- `file-to-data-uri.js` converts `Buffer` → base64 for direct MongoDB storage
- 2 MB limit enforced at middleware level before controller executes

Key Files
---------
| File | Purpose |
| `backend/models/event.js` | Event schema with pre-save hook and compound index |
| `backend/services/event-service.js` | Business logic: getEvents, createEvent, updateEvent, deleteEvent |
| `backend/controllers/event-controller.js` | HTTP handlers |
| `backend/api/event-routes.js` | Routes with auth guards and file upload middleware |
| `backend/validators/event-validators.js` | Zod schemas (create, update, status, booking) |
| `backend/middleware/upload-middleware.js` | Multer in-memory storage, 2 MB limit |
| `backend/utils/file-to-data-uri.js` | Buffer → base64 data URI converter |

Event Schema
------------
```js
{
  title, description, date, time, location, category,
  image,            // base64 data URI or external URL
  totalSeats,
  availableSeats,   // auto-managed, never goes below 0
  price,
  approvalRequired, // true if price > 0
  status,           // 'active' | 'inactive'
  createdBy,        // ObjectId → User
  tags,             // [String]
}
```

Categories: `Tech | Sports | Business | Music | Art | Food | Other`

API Endpoints
-------------
| Method | Path | Auth | Description |
| GET | `/api/events` | Public | Paginated list of active events |
| GET | `/api/events/:id` | Public | Single event detail |
| GET | `/api/events/admin/all` | Admin | All events (active + inactive) |
| POST | `/api/events` | Admin | Create event (multipart/form-data) |
| PUT | `/api/events/:id` | Admin | Update event |
| DELETE | `/api/events/:id` | Admin | Delete event + cascade bookings |
| PATCH | `/api/events/admin/:id/status` | Admin | Toggle active/inactive |

Query Parameters (GET /api/events)
----------------------------------
| Param | Type | Default | Description |
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page (max 50) |
| `category` | string | — | Filter by category |
| `search` | string | — | Regex search on title + location |

Seat Count Logic
----------------
```
On booking (approved):  availableSeats -= seats
On booking cancelled:   availableSeats += seats
On event update:        availableSeats = newTotalSeats - approvedBookingsCount
Cannot reduce totalSeats below already-approved booking count
```

Challenges & Solutions
----------------------
| Challenge | Solution |
| Reducing totalSeats below confirmed bookings | Aggregate approved seats first; reject if new total < approved count |
| Image upload in serverless (no disk) | Multer memoryStorage → base64 data URI stored in MongoDB |
| Category typos from clients | Zod `z.enum(CATEGORIES)` rejects invalid values at validation layer |

Output
------
- 22 events seeded in MongoDB Atlas across 7 categories
- `GET /api/events` returns paginated results in < 150 ms (cached connection)
- Admin dashboard shows all events with activate/deactivate/edit/delete controls
