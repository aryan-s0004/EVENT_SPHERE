PROJECT: EVENTSPHERE
VERSION: 1.0.0
DEVELOPER: ARYAN SAHU
DESCRIPTION: A full-stack MERN platform for managing and booking professional events.

============================================================
1. PROJECT OVERVIEW
============================================================
EventSphere is a high-performance event management system designed for colleges and professional organizations. It allows administrators to create and manage events, while users can browse, book, and receive OTP-based verification for their registrations.

============================================================
2. CORE FEATURES
============================================================
- Clean Admin Dashboard (Event Analytics, Booking Management)
- User Authentication (Registration, Login, Profile)
- OTP Verification (via Email/SMTP)
- Secure Booking Flow (Real-time availability)
- Responsive Modern UI (Glassmorphism + Dark Mode)
- Automated Email Notifications

============================================================
3. TECHNOLOGY STACK
============================================================
- FRONTEND: React.js, Vite, Axios, Lucide-React
- BACKEND: Node.js, Express.js
- DATABASE: MongoDB (Atlas)
- AUTH: JSON Web Tokens (JWT)
- EMAIL: Nodemailer (SMTP), Resend API
- SECURITY: Helmet, CORS, Rate-limiting

============================================================
4. FOLDER STRUCTURE
============================================================
backend/
  controllers/   - Request handlers & business logic
  routes/        - API endpoint definitions
  models/        - Mongoose database schemas
  middleware/    - Auth guards & error handlers
  utils/         - Helper functions (Email, Logger)

frontend/
  components/    - Reusable UI elements
  pages/         - Screen-level components
  services/      - API communication layer

project-docs/     - System documentation & Viva prep

============================================================
5. HOW TO RUN LOCALLY
============================================================
1. Prerequisites: Install Node.js & MongoDB
2. Clone project
3. Backend Setup:
   - cd backend
   - npm install
   - Create .env (see .env.example)
   - npm run dev
4. Frontend Setup:
   - cd frontend
   - npm install
   - npm run dev
5. Access: Open http://localhost:3000

============================================================
6. PRODUCTION NOTES
============================================================
The project is configured for Vercel Serverless deployment.
The /api folder in root acts as the serverless entry point.
Backend logic is located in the /backend directory.
