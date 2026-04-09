# EventSphere

EventSphere is a full-stack event management platform where users can discover and book events while admins create events and control booking approvals.

## Tech Stack

- Frontend: React, Vite, React Router, Axios, React Hot Toast
- Backend: Node.js, Express, Mongoose, JWT, Nodemailer
- Database: MongoDB Atlas

## Core Features

- Email/password authentication with OTP verification
- Forgot-password flow with separate OTP verification step
- Optional Google sign-in when OAuth env is configured
- Role-based access for admin and user accounts
- Dynamic event listing and event details
- Booking flow with free auto-approval and paid admin approval
- Admin dashboard for event management and booking moderation
- Session-scoped auth storage for safer multi-tab behavior

## Project Structure

- `backend/` API, models, controllers, middleware, utilities
- `frontend/` React application
- `docs/` project notes, setup guide, and audit/progress records

## Setup

1. Install backend dependencies:
```bash
cd backend
npm install
```
2. Install frontend dependencies:
```bash
cd frontend
npm install
```
3. Copy values from `.env.example` into:
- `backend/.env`
- `frontend/.env`

4. Recommended local env values:
- backend:
  - `CLIENT_URL=http://localhost:5173`
  - `CLIENT_URLS=http://localhost:5173`
  - `OTP_CONSOLE_FALLBACK=true` for local testing if SMTP is not ready
- frontend:
  - `VITE_API_BASE_URL=http://localhost:5000/api`
  - `VITE_GOOGLE_CLIENT_ID=` can be left empty if Google login is not used

## Run

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

Windows shortcut:
```bat
run_project.bat
```

## Build

```bash
cd frontend
npm run build
```

## Production API Notes

- Public APIs:
  - `GET /api/events`
  - `GET /api/events/:id`
- Auth APIs:
  - `POST /api/auth/register`
  - `POST /api/auth/verify-otp`
  - `POST /api/auth/login`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/verify-reset-otp`
  - `POST /api/auth/reset-password`
- Admin APIs:
  - `GET /api/events/admin/all`
  - `POST /api/events`
  - `PUT /api/events/:id`
  - `DELETE /api/events/:id`
  - `GET /api/bookings/admin/all`
  - `PUT /api/bookings/:id/status`

## Deployment

Recommended split deployment:
- Frontend on Vercel
- Backend on Render

### Frontend on Vercel

Suggested settings:
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Required environment variables:
- `VITE_API_BASE_URL=https://your-backend-domain/api`
- `VITE_GOOGLE_CLIENT_ID=your_google_client_id` if using Google sign-in

### Backend on Render

Suggested settings:
- Service Type: Web Service
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Required environment variables:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `CLIENT_URL`
- `CLIENT_URLS`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Optional environment variables:
- `GOOGLE_CLIENT_ID`
- `ALLOW_VERCEL_PREVIEWS`
- `OTP_CONSOLE_FALLBACK`

Deployment order:
1. Deploy backend first and confirm `/health` works.
2. Add the backend URL to Vercel as `VITE_API_BASE_URL`.
3. Deploy frontend.
4. Update backend `CLIENT_URL` and `CLIENT_URLS` with the final frontend domain.

## Recommended Commit Messages

- `chore(backend): initialize server and shared configuration`
- `feat(auth): add OTP-based authentication and profile flows`
- `feat(events): add public event discovery and admin event management`
- `feat(bookings): add booking workflow and approval handling`
- `feat(frontend): add user and admin application screens`
- `docs: add setup, architecture, and deployment guides`

## Documentation

- [Project Documentation](docs/Podcast_Project.txt)
- [GitHub Setup Guide](docs/github_setup.txt)
- [System Data Notes](docs/xyz.txt)
