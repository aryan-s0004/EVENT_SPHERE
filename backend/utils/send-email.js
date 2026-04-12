// backend/utils/send-email.js
// Email sender with three-tier delivery:
//   1. Resend API   (set RESEND_API_KEY) — recommended for Vercel/serverless
//   2. SMTP/Gmail   (set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
//   3. Console log  (set OTP_CONSOLE_FALLBACK=true) — dev / last resort
//
// Priority order: Resend → SMTP → Console fallback

const nodemailer = require('nodemailer');
const ApiError   = require('./api-error');

// ── Resend (HTTP API — works on Vercel, no SMTP port needed) ─────────────────

const sendViaResend = async ({ to, subject, html }) => {
  const { Resend } = require('resend');
  const resend     = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.EMAIL_USER
    ? `EVENTSPHERE <${process.env.EMAIL_USER}>`
    : 'EVENTSPHERE <onboarding@resend.dev>';

  const result = await resend.emails.send({ from, to, subject, html });

  if (result.error) {
    throw Object.assign(new Error(result.error.message || 'Resend API error'), {
      code: result.error.name,
    });
  }

  return { delivered: true, fallback: false, via: 'resend' };
};

// ── SMTP (nodemailer) ─────────────────────────────────────────────────────────

const SMTP_KEYS = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
let transporter  = null;

const hasSMTPConfig = () => SMTP_KEYS.every((k) => String(process.env[k] || '').trim());

const getTransporter = () => {
  if (transporter) return transporter;

  // Port 465 = implicit SSL (works on Vercel).  587 = STARTTLS (often blocked on cloud).
  const port   = Number(process.env.EMAIL_PORT) || 465;
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout:   8000,
    socketTimeout:     8000,
  });

  return transporter;
};

const sendViaSMTP = async ({ to, subject, html }) => {
  await getTransporter().sendMail({
    from:    `"EVENTSPHERE" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
  return { delivered: true, fallback: false, via: 'smtp' };
};

// ── Console fallback ──────────────────────────────────────────────────────────

const consoleAllowed = () => process.env.OTP_CONSOLE_FALLBACK === 'true';

const sendViaConsole = ({ to, subject, logLabel, debugValue }) => {
  console.warn(`[email:${logLabel}] CONSOLE FALLBACK — To: ${to} | ${subject}`);
  if (debugValue) console.log(`[email:${logLabel}] OTP: ${debugValue}`);
  return { delivered: false, fallback: true, via: 'console' };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sendEmail({ to, subject, html, logLabel, debugValue })
 * @returns {{ delivered: boolean, fallback: boolean, via: string }}
 * @throws  {ApiError}
 */
const sendEmail = async ({ to, subject, html, logLabel = 'mail', debugValue = '' }) => {
  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend({ to, subject, html });
    } catch (err) {
      console.error(`[email:${logLabel}] Resend failed:`, err.message);
      // fall through to SMTP
    }
  }

  // 2. SMTP
  if (hasSMTPConfig()) {
    try {
      return await sendViaSMTP({ to, subject, html });
    } catch (err) {
      console.error(`[email:${logLabel}] SMTP failed for ${to}:`, err.message);
      transporter = null; // reset for next attempt

      if (err.code === 'EAUTH') {
        if (consoleAllowed()) return sendViaConsole({ to, subject, logLabel, debugValue });
        throw new ApiError(502, 'EMAIL_AUTH_FAILED',
          'Gmail rejected credentials. Use a Gmail App Password (not your regular password).');
      }
      // fall through to console
    }
  }

  // 3. Console fallback
  if (consoleAllowed()) {
    return sendViaConsole({ to, subject, logLabel, debugValue });
  }

  throw new ApiError(503, 'EMAIL_SERVICE_UNAVAILABLE',
    'Email delivery failed. Configure RESEND_API_KEY or enable OTP_CONSOLE_FALLBACK.');
};

module.exports = sendEmail;
