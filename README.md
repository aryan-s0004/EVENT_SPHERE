# 🌐 EventSphere — Modern Event Management Platform

[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://event-sphere-navy.vercel.app)
[![MERN](https://img.shields.io/badge/Stack-MERN-green?logo=mongodb)](https://www.mongodb.com/mern-stack)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**EventSphere** is a high-performance, full-stack event management system designed for seamless discovery, booking, and administrative control. Built with the **MERN** stack (MongoDB, Express, React, Node.js), it features secure OTP authentication, atomic booking logic, and a robust administrative suite.

---

## 🚀 Key Features

- **🔐 Secure Authentication**: Email-based registration with OTP verification and password reset flows.
- **📅 Event Discovery**: Dynamic search, category filtering, and real-time availability tracking.
- **🛒 Atomic Booking**: Seat-locking mechanism to prevent race conditions during peak traffic.
- **🛡️ Admin Dashboard**: Full CRUD for events, user management, and booking approval oversight.
- **📧 Notifications**: Automated email confirmations and OTP delivery via Resend/SMTP.
- **⚡ Serverless Performance**: Optimized for serverless environments with intelligent DB connection pooling.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Axios, Lucide Icons.
- **Backend**: Node.js, Express, Mongoose (MVC Architecture).
- **Database**: MongoDB Atlas (Primary) & Redis (Rate Limiting).
- **Security**: JWT (Stateless Auth), bcryptjs, Helmet, Express Rate Limit.
- **Deployment**: Vercel (frontend & serverless functions).

---

## 📂 Project Structure

```text
EVENT_SPHERE/
├── api/             # Vercel serverless entry point
├── backend/         # MVC Express Application
│   ├── controllers/ # Business logic
│   ├── models/      # Mongoose schemas
│   ├── routes/      # API endpoints
│   ├── middleware/  # Auth & Safety
│   └── utils/       # Shared helpers
├── frontend/        # React Application (Vite)
│   ├── src/pages/   # Page components
│   ├── src/services/# API integration
│   └── src/theme/   # UI Styling
├── scripts/         # DB Seed/Reset utilities
└── project-docs/    # Extended technical manuals
```

---

## ⚙️ Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aryan-s0004/EVENT_SPHERE.git
   cd EVENT_SPHERE
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Add your `MONGO_URI`, `JWT_SECRET`, and `EMAIL_` credentials.

3. **Install Dependencies**:
   ```bash
   # Root / Shared
   npm install
   # Backend
   cd backend && npm install
   # Frontend
   cd ../frontend && npm install
   ```

4. **Run the Application**:
   ```bash
   # Root folder
   npm run dev
   ```

---

## ☁️ Deployment

This project is configured for **Vercel**. 
- The backend runs as serverless functions (see `vercel.json`).
- Ensure all environment variables are added in the Vercel Dashboard for both `Preview` and `Production` cycles.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Developed with ❤️ by [Aryan Sahu](https://github.com/aryan-s0004)**
