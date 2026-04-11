// lib/utils/sendEmail.js
// Nodemailer-based email sender with console-fallback support.
//
// Configuration requires these environment variables:
//   EMAIL_HOST  — SMTP hostname (e.g. smtp.gmail.com)
//   EMAIL_PORT  — SMTP port (587 for TLS, 465 for SSL)
//   EMAIL_USER  — Sender email address
//   EMAIL_PASS  — Gmail App Password (not your normal Gmail password)
//
// Set OTP_CONSOLE_FALLBACK=true in .env to log OTPs to the console instead
// of sending real emails — handy during local development when SMTP is not
// configured.

const nodemailer = require('nodemailer');
const ApiError   = require('./api-error');

const REQUIRED_EMAIL_KEYS = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];

// Lazy-initialised Nodemailer transporter (one per container, reused across
// warm invocations to avoid the TCP handshake overhead on every request).
let transporter = null;

const hasEmailConfig = () =>
  REQUIRED_EMAIL_KEYS.every((k) => String(process.env[k] || '').trim());

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     10000,
  });

  return transporter;
};

/**
 * sendEmail({ to, subject, html, logLabel, debugValue })
 *
 * Sends an HTML email via SMTP.  Falls back to console logging if
 * OTP_CONSOLE_FALLBACK=true and SMTP is not configured or fails.
 *
 * @returns {{ delivered: boolean, fallback: boolean }}
 * @throws  {ApiError} when email is not configured and fallback is disabled
 */
const sendEmail = async ({ to, subject, html, logLabel = 'mail', debugValue = '' }) => {
  if (!hasEmailConfig()) {
    console.error(`[email:${logLabel}] SMTP not configured`);

    if (process.env.OTP_CONSOLE_FALLBACK === 'true') {
      console.warn(`[email:${logLabel}] FALLBACK — To: ${to} | ${subject}`);
      if (debugValue) console.log(`[email:${logLabel}] OTP: ${debugValue}`);
      return { delivered: false, fallback: true, reason: 'SMTP_NOT_CONFIGURED' };
    }

    throw new ApiError(503, 'EMAIL_SERVICE_MISSING', 'Email service is not configured');
  }

  try {
    await getTransporter().sendMail({
      from:    `"EVENTSPHERE" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    return { delivered: true, fallback: false };
  } catch (error) {
    console.error(`[email:${logLabel}] Failed for ${to}:`, error.message);
    transporter = null; // reset so next attempt creates a fresh transporter

    if (process.env.OTP_CONSOLE_FALLBACK === 'true') {
      console.warn(`[email:${logLabel}] FALLBACK — To: ${to} | ${subject}`);
      if (debugValue) console.log(`[email:${logLabel}] OTP: ${debugValue}`);
      return { delivered: false, fallback: true, reason: error.message };
    }

    if (error.code === 'EAUTH') {
      throw new ApiError(502, 'EMAIL_AUTH_FAILED',
        'Gmail rejected your credentials. Use a Gmail App Password, not your normal password.');
    }

    throw new ApiError(502, 'EMAIL_FAILED', 'Unable to send email right now. Please try again.');
  }
};

module.exports = sendEmail;
