import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolveAssetUrl } from '../services/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>
        <span style={styles.brandIcon}>ES</span> EVENTSPHERE
      </Link>

      <div style={styles.right}>
        <Link to="/events" style={styles.navLink}>Events</Link>

        {user ? (
          <>
            {user.role === 'admin' && (
              <Link to="/admin" style={styles.navLink}>Dashboard</Link>
            )}
            {user.role !== 'admin' && (
              <Link to="/my-bookings" style={styles.navLink}>My Bookings</Link>
            )}
            <Link to="/profile" style={styles.profileBtn}>
              {user.avatar ? (
                <img src={resolveAssetUrl(user.avatar)} style={styles.avatar} alt="" />
              ) : (
                <span style={styles.avatarFallback}>{(user.name || 'U')[0].toUpperCase()}</span>
              )}
              <span style={styles.profileName}>{user.name}</span>
            </Link>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.loginBtn}>Login</Link>
            <Link to="/register" style={styles.registerBtn}>Register</Link>
          </>
        )}

        <button
          onClick={toggleTheme}
          style={styles.themeBtn}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow-sm)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    gap: '12px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontWeight: '800',
    fontSize: '1.1rem',
    letterSpacing: '1.5px',
    color: 'var(--text)',
    flexShrink: 0,
  },
  brandIcon: { color: 'var(--primary)', fontSize: '0.72rem', fontWeight: '800' },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  navLink: {
    padding: '6px 12px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    borderRadius: '6px',
    fontWeight: '500',
    transition: 'color 0.2s, background 0.2s',
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '4px 12px 4px 6px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--surface-alt)',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: '500',
    color: 'var(--text)',
    transition: 'background 0.2s',
  },
  profileName: {
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  avatar: { width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  logoutBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: '500',
  },
  loginBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.88rem',
    fontWeight: '500',
  },
  registerBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid var(--primary)',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    fontSize: '0.88rem',
    fontWeight: '600',
  },
  themeBtn: {
    minWidth: '56px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--surface-alt)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s',
    padding: '0 10px',
  },
};
