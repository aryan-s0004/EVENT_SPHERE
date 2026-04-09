import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage, resolveAssetUrl } from '../services/api';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0] || null;
    setAvatar(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('phone', form.phone);
      if (avatar) formData.append('avatar', avatar);

      const { data } = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
      setPreview(null);
      setAvatar(null);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = preview
    || resolveAssetUrl(user?.avatar)
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=3b82f6&color=fff&size=128`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.pageTitle}>My Profile</h2>

        {/* Avatar section */}
        <div style={styles.avatarSection}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={avatarSrc} alt="avatar" style={styles.avatar} />
            {preview && (
              <span style={styles.previewBadge}>Preview</span>
            )}
          </div>
          <div>
            <h3 style={{ color: 'var(--text)', fontWeight: '700', marginBottom: '2px' }}>{user?.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</p>
            {user?.role === 'admin' && (
              <span style={styles.adminBadge}>Admin</span>
            )}
          </div>
        </div>

        <div style={styles.divider} />

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Full Name</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
          />

          <label style={styles.label}>Phone Number</label>
          <input
            className="form-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="e.g. +91 9876543210"
          />

          <label style={styles.label}>Profile Photo</label>
          <input
            type="file"
            accept="image/*"
            className="form-input"
            onChange={handleAvatarChange}
            style={{ cursor: 'pointer' }}
          />

          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 20px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '32px 28px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-md)',
  },
  pageTitle: { fontSize: '1.3rem', fontWeight: '800', marginBottom: '24px', color: 'var(--text)' },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid var(--border)',
    display: 'block',
  },
  previewBadge: {
    position: 'absolute',
    bottom: '-6px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
  adminBadge: {
    display: 'inline-block',
    marginTop: '6px',
    padding: '2px 10px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text)',
    marginBottom: '5px',
  },
};
