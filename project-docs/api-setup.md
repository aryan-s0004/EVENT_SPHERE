# API Keys & Environment Setup Guide

Complete step-by-step guide to configure all external services used by EventSphere.

---

## 1. MongoDB Atlas

### Create a free cluster
1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Sign up / log in → **Create a New Project** → name it `EventSphere`
3. Click **Build a Database** → choose **M0 Free** → select nearest region → **Create**

### Create a database user
1. In the left sidebar → **Database Access** → **Add New Database User**
2. Choose **Password** authentication
3. Username: `eventsphere`, Password: generate a strong password
4. **Database User Privileges** → Built-in Role → **Read and write to any database**
5. Click **Add User**

### Whitelist all IPs (for Vercel)
1. Left sidebar → **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (`0.0.0.0/0`)
3. Click **Confirm**

### Get connection string
1. Left sidebar → **Database** → **Connect** → **Drivers**
2. Copy the URI, replace `<password>` with your database user's password
3. Replace `/myFirstDatabase` with `/EVENTSPHERE`

```
mongodb+srv://eventsphere:<password>@cluster0.xxxxx.mongodb.net/EVENTSPHERE?retryWrites=true&w=majority
```

> ⚠️ The database name `EVENTSPHERE` is case-sensitive. MongoDB Atlas will error if you connect with a different casing.

---

## 2. JWT Secret

Generate a cryptographically strong 64-byte secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output — this becomes your `JWT_SECRET`.

**Never use a short string like `"secret"` or `"myapp"` in production.**

---

## 3. Gmail App Password (for SMTP)

> **Note:** App Passwords only work if your Google account has 2-Step Verification enabled.

### Steps
1. Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Under **How you sign in to Google** → click **2-Step Verification** → enable it
3. Go back to Security → search **App Passwords** or go directly to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Select app: **Mail** → Select device: **Other (custom name)** → type `EventSphere`
5. Click **Generate**
6. Copy the 16-character password (shown once — save it immediately)

### Use in .env
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop   # the 16-char App Password (spaces OK)
```

> ⚠️ On Vercel, use port `465` (SSL) — port `587` (STARTTLS) is often blocked by AWS outbound rules.

---

## 4. Resend API (Recommended for Vercel)

Resend uses HTTPS instead of SMTP — it works reliably from any serverless environment.

### Steps
1. Go to [https://resend.com](https://resend.com) → Sign up free (3,000 emails/month)
2. Dashboard → **API Keys** → **Create API Key** → name it `EventSphere`
3. Copy the key (starts with `re_`)

### Add to Vercel
```bash
printf "re_your_key_here" | npx vercel env add RESEND_API_KEY production
npx vercel --prod --yes
```

### Use in .env (local)
```env
RESEND_API_KEY=re_your_key_here
```

When `RESEND_API_KEY` is set, it takes priority over SMTP. If Resend fails, SMTP is tried as fallback.

---

## 5. Complete .env Files

### Root `.env` (used by Vercel serverless functions)
```env
MONGO_URI=mongodb+srv://eventsphere:<password>@cluster0.xxxxx.mongodb.net/EVENTSPHERE?retryWrites=true&w=majority

JWT_SECRET=<64-char hex from step 2>
JWT_EXPIRE=7d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop

# RESEND_API_KEY=re_xxx   # uncomment if using Resend

OTP_CONSOLE_FALLBACK=false   # set true only for local testing

ADMIN_NAME=Admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=Admin@EventSphere1!

SEED_SECRET=<any-random-string-you-choose>
```

### `backend/.env` (used when running Express standalone)
```env
PORT=5000
NODE_ENV=development

MONGO_URI=<same as above>
JWT_SECRET=<same as above>
JWT_EXPIRE=7d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop

OTP_CONSOLE_FALLBACK=true   # convenient for local dev

ALLOWED_ORIGINS=http://localhost:3000
```

### `frontend/.env` (used by Vite)
```env
VITE_API_URL=/api   # proxy to Express in dev; same-origin on Vercel
```

---

## 6. Adding Env Vars to Vercel

### Via CLI (recommended — no copy-paste errors)
```bash
# For each variable:
printf "VALUE_HERE" | npx vercel env add VARIABLE_NAME production

# Example:
printf "mongodb+srv://..." | npx vercel env add MONGO_URI production
```

### Via Vercel Dashboard
1. vercel.com → Your project → **Settings** → **Environment Variables**
2. Add each key-value pair
3. Re-deploy for changes to take effect: `vercel --prod --yes`

### Verify what's set
```bash
npx vercel env ls
```

---

## 7. Security Checklist

- [ ] `.env` files are in `.gitignore` — never committed
- [ ] `JWT_SECRET` is 64+ bytes of random data
- [ ] Gmail App Password used (not your actual Gmail password)
- [ ] MongoDB Atlas IP whitelist set to `0.0.0.0/0` (for Vercel dynamic IPs)
- [ ] `SEED_SECRET` is a non-guessable random string
- [ ] `OTP_CONSOLE_FALLBACK=false` in production
- [ ] `ACCOUNTS.txt` is gitignored
