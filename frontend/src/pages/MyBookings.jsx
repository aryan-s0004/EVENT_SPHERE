import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage, resolveAssetUrl } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

// Status colors: Pending = Yellow, Approved = Green, Rejected = Red, Cancelled = Grey
const STATUS_CONFIG = {
  pending:   { label: 'Pending — Waiting for admin approval', bg: '#fef3c7', fg: '#92400e' },
  approved:  { label: 'Approved — Booking Confirmed!',        bg: '#d1fae5', fg: '#065f46' },
  rejected:  { label: 'Rejected — Booking Declined',         bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { label: 'Cancelled',                           bg: '#f3f4f6', fg: '#6b7280' },
};

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState(null);

  const fetchBookings = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/bookings/mine');
      setBookings(response.data.bookings || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load bookings'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch bookings on mount (manual refresh available via button)
  useEffect(() => {
    if (user?.role === 'admin') return;
    fetchBookings();
  }, [user?.role]);

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;

  const handleCancel = async (id) => {
    setCancelId(id);
    try {
      const response = await api.patch(`/bookings/${id}/cancel`);
      toast.success(response.data.message || 'Booking cancelled');
      await fetchBookings({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to cancel booking'));
    } finally {
      setCancelId('');
      setBookingToCancel(null);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>My Bookings</h2>
      </div>
      <ConfirmModal
        open={Boolean(bookingToCancel)}
        title="Cancel booking?"
        message="Are you sure you want to cancel this booking? Approved seats will be released back to the event."
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        busy={cancelId === bookingToCancel}
        onCancel={() => setBookingToCancel(null)}
        onConfirm={() => handleCancel(bookingToCancel)}
      />

      {loading && (
        <div className="spinner-wrap"><div className="spinner" /></div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">Bookings</div>
          <h3>No bookings yet</h3>
          <p>You haven't booked any events. Start exploring!</p>
          <Link to="/events" style={styles.browseBtn}>Browse Events</Link>
        </div>
      )}

      {bookings.length > 0 && (
        <div style={styles.list}>
          {bookings.map((booking) => {
            const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const canCancel = booking.status === 'pending' || booking.status === 'approved';

            return (
              <div key={booking._id} style={styles.card} className="card-hover">
                {booking.event?.image && (
                  <img
                    src={resolveAssetUrl(booking.event.image)}
                    alt=""
                    style={styles.cardImg}
                  />
                )}
                <div style={styles.cardBody}>
                  <div style={styles.topRow}>
                    <div>
                      <h3 style={styles.eventTitle}>
                        {booking.event?.title || 'Event removed'}
                      </h3>
                      <p style={styles.meta}>
                        {booking.event?.date
                          ? new Date(booking.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                          : 'Date unavailable'}
                        {booking.event?.time && ` | ${booking.event.time}`}
                      </p>
                      {booking.event?.location && (
                        <p style={styles.meta}>Location: {booking.event.location}</p>
                      )}
                    </div>
                    <span style={{ ...styles.statusBadge, background: cfg.bg, color: cfg.fg }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailChip}>Seats: {booking.seats} seat{booking.seats > 1 ? 's' : ''}</span>
                    <span style={styles.detailChip}>
                      Total: {booking.totalPrice > 0 ? `Rs ${booking.totalPrice}` : 'Free'}
                    </span>
                    <span style={styles.detailChip}>
                      Booked: {new Date(booking.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  {booking.status === 'pending' && (
                    <p style={styles.infoNote}>
                      Waiting for admin approval. You will receive an email once reviewed.
                    </p>
                  )}

                  {canCancel && (
                    <button
                      style={styles.cancelBtn}
                      onClick={() => setBookingToCancel(booking._id)}
                      disabled={cancelId === booking._id}
                    >
                      {cancelId === booking._id ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  pageTitle: { fontSize: '1.5rem', fontWeight: '800', marginBottom: '24px', color: 'var(--text)' },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    display: 'flex',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  cardImg: {
    width: '130px',
    flexShrink: 0,
    objectFit: 'cover',
    display: 'block',
  },
  cardBody: { flex: 1, padding: '18px', minWidth: '240px' },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  eventTitle: { fontSize: '1.05rem', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' },
  meta: { color: 'var(--text-muted)', fontSize: '0.83rem', margin: '2px 0' },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  detailRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  detailChip: {
    padding: '3px 10px',
    borderRadius: '999px',
    background: 'var(--neutral-bg)',
    color: 'var(--neutral-fg)',
    fontSize: '0.8rem',
    fontWeight: '500',
  },
  infoNote: {
    color: 'var(--warning-fg)',
    background: 'var(--warning-bg)',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.82rem',
    marginBottom: '12px',
  },
  cancelBtn: {
    padding: '6px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--error-fg)',
    background: 'transparent',
    color: 'var(--error-fg)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  refreshBtn: {
    padding: '7px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  browseBtn: {
    display: 'inline-block',
    marginTop: '16px',
    padding: '10px 24px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
};
