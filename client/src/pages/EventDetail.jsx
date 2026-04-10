import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage, resolveAssetUrl } from '../services/api';

const CATEGORY_COLORS = {
  Tech: '#3b82f6',
  Sports: '#22c55e',
  Business: '#a855f7',
  Music: '#ec4899',
  Art: '#f97316',
  Food: '#eab308',
  Other: '#6b7280',
};

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  const fetchEvent = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get(`/events/${id}`);
      setEvent(response.data.event);
    } catch {
      navigate('/events');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    const intervalId = window.setInterval(() => fetchEvent({ silent: true }), 5000);
    return () => window.clearInterval(intervalId);
  }, [id]);

  const handleBook = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      toast.error('Admins manage events from the dashboard');
      return;
    }

    setBooking(true);
    try {
      const response = await api.post('/bookings', { eventId: id, seats });
      toast.success(response.data.message || 'Booking created');
      await fetchEvent({ silent: true });
      navigate('/my-bookings');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Booking failed'));
    } finally {
      setBooking(false);
    }
  };

  if (loading || !event) {
    return (
      <div className="container">
        <div className="spinner-wrap"><div className="spinner" /></div>
      </div>
    );
  }

  const isFull = event.availableSeats === 0;
  const maxSeats = Math.max(1, Math.min(event.availableSeats || 1, 10));
  const catColor = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Other;

  return (
    <div className="container">
      <Link to="/events" style={styles.backLink}>Back to Events</Link>

      {event.image && (
        <img src={resolveAssetUrl(event.image)} alt={event.title} style={styles.banner} />
      )}

      <div style={styles.contentGrid}>
        <div style={styles.details}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ ...styles.catBadge, background: `${catColor}18`, color: catColor }}>
              {event.category}
            </span>
            <span style={{ ...styles.approvalBadge, background: event.approvalRequired ? 'var(--warning-bg)' : 'var(--success-bg)', color: event.approvalRequired ? 'var(--warning-fg)' : 'var(--success-fg)' }}>
              {event.approvalRequired ? 'Requires approval' : 'Instant confirmation'}
            </span>
          </div>

          <h1 style={styles.title}>{event.title}</h1>

          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <div>
                <div style={styles.metaLabel}>Date</div>
                <div style={styles.metaValue}>
                  {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div style={styles.metaItem}>
              <div>
                <div style={styles.metaLabel}>Time</div>
                <div style={styles.metaValue}>{event.time}</div>
              </div>
            </div>
            <div style={styles.metaItem}>
              <div>
                <div style={styles.metaLabel}>Location</div>
                <div style={styles.metaValue}>{event.location}</div>
              </div>
            </div>
            <div style={styles.metaItem}>
              <div>
                <div style={styles.metaLabel}>Seats Available</div>
                <div style={{ ...styles.metaValue, color: isFull ? 'var(--error-fg)' : 'var(--success-fg)', fontWeight: '700' }}>
                  {isFull ? 'Sold Out' : `${event.availableSeats} / ${event.totalSeats}`}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.descBox}>
            <h3 style={styles.descTitle}>About this event</h3>
            <p style={styles.desc}>{event.description}</p>
          </div>

          {event.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {event.tags.map((tag) => (
                <span key={tag} style={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.bookingCard}>
            <div style={styles.priceRow}>
              <span style={styles.price}>
                {event.price === 0 ? 'Free' : `Rs ${event.price}`}
              </span>
              {event.price > 0 && <span style={styles.perSeat}>per seat</span>}
            </div>

            {!isFull && user?.role !== 'admin' && (
              <>
                <div style={styles.seatsControl}>
                  <label style={styles.seatsLabel}>Number of seats</label>
                  <div style={styles.seatsPicker}>
                    <button
                      style={styles.seatsBtn}
                      type="button"
                      onClick={() => setSeats((s) => Math.max(1, s - 1))}
                      disabled={seats <= 1}
                    >
                      -
                    </button>
                    <span style={styles.seatsNum}>{seats}</span>
                    <button
                      style={styles.seatsBtn}
                      type="button"
                      onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))}
                      disabled={seats >= maxSeats}
                    >
                      +
                    </button>
                  </div>
                </div>

                {event.price > 0 && (
                  <div style={styles.totalRow}>
                    <span>Total</span>
                    <span style={{ fontWeight: '800', color: 'var(--text)' }}>Rs {event.price * seats}</span>
                  </div>
                )}

                <button
                  style={styles.bookBtn}
                  onClick={handleBook}
                  disabled={booking}
                >
                  {booking ? 'Processing...' : 'Book Now'}
                </button>

                {event.approvalRequired && (
                  <p style={styles.approvalNote}>
                    You will receive email confirmation once approved by admin.
                  </p>
                )}
              </>
            )}

            {isFull && (
              <div style={styles.soldOutBox}>
                <strong>Sold Out</strong>
                <p>This event has no more seats available.</p>
              </div>
            )}

            {user?.role === 'admin' && (
              <div style={styles.adminNote}>
                <strong>Admin view</strong>
                <p>Manage this event from the <Link to="/admin" style={{ color: 'var(--accent)' }}>dashboard</Link>.</p>
              </div>
            )}

            {!user && (
              <div style={styles.loginNote}>
                <Link to="/login" style={styles.loginNoteBtn}>Sign in to book</Link>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                  Don't have an account? <Link to="/register" style={{ color: 'var(--accent)' }}>Register</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backLink: { display: 'inline-block', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px', fontWeight: '500' },
  banner: {
    width: '100%',
    maxHeight: '380px',
    objectFit: 'cover',
    borderRadius: '14px',
    marginBottom: '28px',
    boxShadow: 'var(--shadow-md)',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: '32px',
    alignItems: 'flex-start',
  },
  details: { minWidth: 0 },
  catBadge: { padding: '3px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
  approvalBadge: { padding: '3px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
  title: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: '800',
    color: 'var(--text)',
    marginBottom: '20px',
    lineHeight: '1.2',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
    padding: '20px',
    background: 'var(--surface-alt)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
  },
  metaItem: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  metaLabel: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' },
  metaValue: { fontSize: '0.92rem', color: 'var(--text)', fontWeight: '600' },
  descBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  descTitle: { fontSize: '1rem', fontWeight: '700', color: 'var(--text)', marginBottom: '10px' },
  desc: { color: 'var(--text-muted)', lineHeight: '1.75', fontSize: '0.95rem' },
  tag: {
    padding: '4px 12px',
    borderRadius: '999px',
    background: 'var(--neutral-bg)',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  sidebar: { position: 'sticky', top: '80px' },
  bookingCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px',
    boxShadow: 'var(--shadow-md)',
  },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px' },
  price: { fontSize: '2rem', fontWeight: '800', color: 'var(--text)' },
  perSeat: { fontSize: '0.85rem', color: 'var(--text-muted)' },
  seatsControl: { marginBottom: '16px' },
  seatsLabel: { display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' },
  seatsPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
    width: 'fit-content',
  },
  seatsBtn: {
    width: '40px',
    height: '40px',
    background: 'var(--surface-alt)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text)',
    transition: 'background 0.15s',
  },
  seatsNum: {
    minWidth: '50px',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: '1.1rem',
    color: 'var(--text)',
    borderLeft: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    height: '40px',
    lineHeight: '40px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    marginBottom: '16px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  bookBtn: {
    width: '100%',
    padding: '13px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '800',
    fontSize: '1rem',
    transition: 'background 0.15s',
  },
  approvalNote: {
    marginTop: '12px',
    color: 'var(--warning-fg)',
    fontSize: '0.82rem',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  soldOutBox: {
    textAlign: 'center',
    padding: '20px',
    background: 'var(--error-bg)',
    borderRadius: '10px',
    color: 'var(--error-fg)',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  adminNote: {
    textAlign: 'center',
    padding: '20px',
    background: 'var(--neutral-bg)',
    borderRadius: '10px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  loginNote: { textAlign: 'center' },
  loginNoteBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.95rem',
    textAlign: 'center',
  },
};
