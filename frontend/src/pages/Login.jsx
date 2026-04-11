import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage } from '../services/api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      toast.success(data.message || 'Welcome back!');
      navigate(data.user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error('Google did not return a valid credential. Please try again.');
      return;
    }
    setGoogleSubmitting(true);
    try {
      const { data } = await api.post('/auth/google', { token: credentialResponse.credential });
      login(data.token, data.user);
      toast.success(data.message || 'Welcome!');
      navigate(data.user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'GOOGLE_NOT_CONFIGURED') {
        toast.error('Google sign-in is not enabled on this deployment.');
      } else if (code === 'VERIFY_EMAIL_FIRST') {
        toast.error('This email has an account — please verify it before using Google sign-in.');
      } else {
        toast.error(getErrorMessage(err, 'Google sign-in failed. Please try again.'));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    toast.error('Google sign-in was blocked or cancelled. Check that pop-ups are allowed for this site.');
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>ES</span>
          <span style={styles.logoText}>EVENTSPHERE</span>
        </div>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleLogin}>
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
            placeholder="Your password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div style={{ textAlign: 'right', marginBottom: '16px', marginTop: '-8px' }}>
            <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
          </div>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {googleClientId && (
          <>
            <div style={styles.divider}><span>or continue with</span></div>

            <div style={{ display: 'flex', justifyContent: 'center', opacity: googleSubmitting ? 0.7 : 1, pointerEvents: googleSubmitting ? 'none' : 'auto' }}>
              <GoogleLogin onSuccess={handleGoogle} onError={handleGoogleError} />
            </div>
            {googleSubmitting && <p style={styles.helper}>Signing in with Google...</p>}
          </>
        )}

        <p style={styles.footer}>
          Don't have an account? <Link to="/register" style={styles.link}>Create one</Link>
        </p>

        {new URLSearchParams(window.location.search).get('debug') === 'true' && (
          <div style={styles.debug}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.7rem' }}>DEBUG INFO</p>
            <p style={{ margin: 0, fontSize: '0.65rem', wordBreak: 'break-all' }}>
              ID: {googleClientId || 'NOT_SET'}
            </p>
          </div>
        )}
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
  forgotLink: { fontSize: '0.82rem', color: 'var(--accent)', fontWeight: '500' },
  divider: {
    textAlign: 'center',
    margin: '20px 0',
    position: 'relative',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  helper: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '12px' },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '0.88rem', color: 'var(--text-muted)' },
  link: { color: 'var(--accent)', fontWeight: '600' },
  debug: {
    marginTop: '20px',
    padding: '10px',
    background: 'rgba(255, 0, 0, 0.05)',
    border: '1px dashed rgba(255, 0, 0, 0.2)',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    textAlign: 'left',
  },
};

