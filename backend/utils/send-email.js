// send-email.js — Three-tier email delivery: Resend API → SMTP → Console fallback.
'use strict';

const nodemailer = require('nodemailer');
const ApiError = require('./api-error');

// ── Resend (HTTP API — works on Vercel, no SMTP port needed) ─────────────────

const sendViaResend = async ({ to, subject, html }) => {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

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

const SMTP_KEYS = ['EMAIL_USER', 'EMAIL_PASS'];
let transporter = null;
let transporterVerified = false;

const hasSMTPConfig = () => SMTP_KEYS.every((k) => String(process.env[k] || '').trim());

const getTransporter = () => {
  if (transporter) return transporter;

  // Optimized for step-by-step debug requirements: use Gmail service shorthand
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // MUST be a 16-character App Password
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

// Verify SMTP credentials once
const verifyTransporter = async () => {
  if (transporterVerified) return;
  try {
    const transport = getTransporter();
    await transport.verify();
    transporterVerified = true;
  } catch (err) {
    transporter = null;
    const hint = err.code === 'EAUTH'
      ? 'Gmail rejected credentials. Make sure EMAIL_PASS is a 16-char App Password (not your Gmail password).'
      : err.message;
    throw Object.assign(err, { hint });
  }
};

const sendViaSMTP = async ({ to, subject, html }) => {
  await verifyTransporter();

  await getTransporter().sendMail({
    from: `"EVENTSPHERE" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  return { delivered: true, fallback: false, via: 'smtp' };
};

// ── Console fallback ──────────────────────────────────────────────────────────

const consoleAllowed = () => process.env.OTP_CONSOLE_FALLBACK === 'true' || process.env.NODE_ENV !== 'production';

const sendViaConsole = ({ to, subject, logLabel, debugValue }) => {
  // FINALIZED OTP LOGGING: Matches "console.log('OTP:', otp)" request
  console.warn(`\n${'─'.repeat(60)}`);
  console.warn(`[email:FALLBACK] Sending to: ${to}`);
  console.warn(`[email:FALLBACK] Subject: ${subject}`);
  if (debugValue) {
    console.log(`OTP: ${debugValue}`); // Explicit requested format
    console.warn(`[email:FALLBACK] ┌─────────────────────────────────┐`);
    console.warn(`[email:FALLBACK] │ CODE: ${debugValue}            │`);
    console.warn(`[email:FALLBACK] └─────────────────────────────────┘`);
  }
  console.warn(`${'─'.repeat(60)}\n`);
  return { delivered: false, fallback: true, via: 'console' };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * sendEmail({ to, subject, html, logLabel, debugValue })
 */
const sendEmail = async ({ to, subject, html, logLabel = 'mail', debugValue = '' }) => {
  // 1. Console Override for Dev/Debug if forced
  if (process.env.FORCE_CONSOLE_OTP === 'true') {
     return sendViaConsole({ to, subject, logLabel, debugValue });
  }

  // 2. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend({ to, subject, html });
    } catch (err) {
      console.error(`[email:${logLabel}] Resend failed, trying SMTP...`);
    }
  }

  // 3. SMTP / Gmail
  if (hasSMTPConfig()) {
    try {
      return await sendViaSMTP({ to, subject, html });
    } catch (err) {
      console.error(`[email:${logLabel}] SMTP failed for ${to}: ${err.hint || err.message}`);
      transporter = null;
      transporterVerified = false;

      if (err.code === 'EAUTH' && consoleAllowed()) {
        return sendViaConsole({ to, subject, logLabel, debugValue });
      }
    }
  }

  // 4. Default Fallback
  if (consoleAllowed()) {
    return sendViaConsole({ to, subject, logLabel, debugValue });
  }

  throw new ApiError(503, 'EMAIL_SERVICE_UNAVAILABLE', 'Email delivery failed. Fix SMTP or set OTP_CONSOLE_FALLBACK=true');
};

module.exports = sendEmail;
