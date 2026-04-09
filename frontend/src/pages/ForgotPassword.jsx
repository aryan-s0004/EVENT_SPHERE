import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <h2 style={styles.title}>Forgot Password</h2>
        {step === 1 ? (
          <form onSubmit={handleForgot}>
            <input style={styles.input} type="email" placeholder="Your email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button style={styles.btn} type="submit" disabled={submitting}>{submitting ? 'Sending OTP...' : 'Send OTP'}</button>
          </form>
        ) : step === 2 ? (
          <form onSubmit={handleVerifyOtp}>
            <p style={styles.hint}>OTP sent to <b>{email}</b></p>
            <input style={styles.input} placeholder="Enter OTP" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            <button style={styles.btn} type="submit" disabled={verifyingOtp}>{verifyingOtp ? 'Verifying...' : 'Verify OTP'}</button>
            <button type="button" style={styles.secondaryBtn} onClick={handleResend} disabled={submitting || resendCooldown > 0}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p style={styles.hint}>OTP verified for <b>{email}</b></p>
            <input style={styles.input} type="password" placeholder="New Password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Confirm Password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button style={styles.btn} type="submit" disabled={resetting}>{resetting ? 'Resetting...' : 'Reset Password'}</button>
            <button type="button" style={styles.secondaryBtn} onClick={() => setStep(2)} disabled={resetting}>
              Back to OTP
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  card: { width: '100%', maxWidth: '380px', padding: '2rem', border: '1px solid #ddd', borderRadius: '10px' },
  title: { textAlign: 'center', marginBottom: '1.5rem', fontWeight: 'bold' },
  hint: { color: '#666', fontSize: '0.9rem', marginBottom: '12px' },
  input: { display: 'block', width: '100%', padding: '9px 12px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.95rem' },
  btn: { width: '100%', padding: '9px', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { width: '100%', padding: '9px', background: '#fff', color: '#111', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' },
};
