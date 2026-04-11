import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage, getErrorCode } from '../services/api';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [resendCooldown]);

  const requestResetOtp = async () => {
    const response = await api.post('/auth/forgot-password', { email });
    setUserId(response.data.userId);
    setStep(2);
    setResendCooldown(response.data.resendAvailableInSeconds || 60);
    toast.success(response.data.message || 'Reset OTP sent');
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requestResetOtp();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to send reset OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerifyingOtp(true);
    try {
      await api.post('/auth/verify-reset-otp', { userId, otp });
      toast.success('OTP verified. Set your new password.');
      setStep(3);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to verify OTP'));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setResetting(true);
    try {
      await api.post('/auth/reset-password', { userId, newPassword });
      toast.success('Password reset. Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to reset password'));
    } finally {
      setResetting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      await requestResetOtp();
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

        <h2 style={styles.title}>Reset Password</h2>

        {step === 1 && (
          <>
            <p style={styles.subtitle}>Enter your email to receive a reset OTP</p>
            <form onSubmit={handleForgot}>
              <label style={styles.label}>Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending OTP...' : 'Send Reset OTP'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p style={styles.subtitle}>
              OTP sent to <strong style={{ color: 'var(--text)' }}>{email}</strong>
            </p>
            <form onSubmit={handleVerifyOtp}>
              <label style={styles.label}>6-digit OTP</label>
              <input
                className="form-input"
                placeholder="Enter OTP from email"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '6px', fontSize: '1.2rem', textAlign: 'center' }}
              />
              <button className="btn-primary" type="submit" disabled={verifyingOtp} style={{ marginBottom: '10px' }}>
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
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
          </>
        )}

        {step === 3 && (
          <>
            <p style={styles.subtitle}>
              OTP verified for <strong style={{ color: 'var(--text)' }}>{email}</strong>
            </p>
            <form onSubmit={handleReset}>
              <label style={styles.label}>New Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <label style={styles.label}>Confirm Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Repeat new password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button className="btn-primary" type="submit" disabled={resetting} style={{ marginBottom: '10px' }}>
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(2)}
                disabled={resetting}
              >
                Back to OTP
              </button>
            </form>
          </>
        )}

        <p style={styles.footer}>
          Remembered it? <Link to="/login" style={styles.link}>Back to Login</Link>
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
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', marginBottom: '5px' },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '0.88rem', color: 'var(--text-muted)' },
  link: { color: 'var(--accent)', fontWeight: '600' },
};
