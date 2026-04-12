import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage, getErrorCode } from '../services/api';

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timeoutId = window.setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [resendCooldown]);

  const sendOtp = async () => {
    const response = await api.post('/auth/register', form);
    setUserId(response.data.userId);
    setStep(2);
    setResendCooldown(response.data.resendAvailableInSeconds || 60);
    toast.success(response.data.message || 'OTP sent to your email');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendOtp();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to send OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      await api.post('/auth/verify-otp', { userId, otp });
      toast.success('Email verified. Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid OTP'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      await sendOtp();
    } catch (err) {
      if (getErrorCode(err) === 'OTP_RESEND_COOLDOWN') {
        setResendCooldown(err.response?.data?.details?.retryAfterSeconds || 60);
      }
      toast.error(getErrorMessage(err, 'Unable to resend OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>ES</span>
          <span style={styles.logoText}>EVENTSPHERE</span>
        </div>

        {step === 1 ? (
          <>
            <h2 style={styles.title}>Create account</h2>
            <p style={styles.subtitle}>Join thousands of event-goers</p>
            <form onSubmit={handleRegister}>
              <label style={styles.label}>Full Name</label>
              <input
                className="form-input"
                placeholder="Your full name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <label style={styles.label}>Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <label style={styles.label}>Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={styles.title}>Verify your email</h2>
            <p style={styles.subtitle}>
              Check your inbox at <strong style={{ color: 'var(--text)' }}>{form.email}</strong>
            </p>
            <form onSubmit={handleVerify}>
              <label style={styles.label}>Enter OTP</label>
              <input
                className="form-input"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '6px', fontSize: '1.2rem', textAlign: 'center' }}
              />
              <button className="btn-primary" type="submit" disabled={verifying} style={{ marginBottom: '10px' }}>
                {verifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResend}
                disabled={submitting || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </form>
            <button
              type="button"
              style={styles.backBtn}
              onClick={() => {
                setStep(1);
                setOtp('');
              }}
            >
              Back to email
            </button>
          </>
        )}

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '36px 32px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-md)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  logoIcon: { fontSize: '0.82rem', color: 'var(--accent)', fontWeight: '800' },
  logoText: { fontWeight: '800', fontSize: '1.1rem', letterSpacing: '1.5px', color: 'var(--text)' },
  title: { textAlign: 'center', fontSize: '1.4rem', fontWeight: '700', marginBottom: '4px', color: 'var(--text)' },
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', marginBottom: '5px' },
  backBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '0.88rem', color: 'var(--text-muted)' },
  link: { color: 'var(--accent)', fontWeight: '600' },
};
