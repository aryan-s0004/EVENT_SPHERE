import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getErrorMessage, resolveAssetUrl } from '../services/api';

const CATEGORIES = ['All', 'Music', 'Tech', 'Sports', 'Art', 'Food', 'Business', 'Other'];

const CATEGORY_COLORS = {
  Tech: '#3b82f6',
  Sports: '#22c55e',
  Business: '#a855f7',
  Music: '#ec4899',
  Art: '#f97316',
  Food: '#eab308',
  Other: '#6b7280',
};

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingEventId, setBookingEventId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const response = await api.get(`/events?${params}`);
      setEvents(response.data.events);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load events'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, category]);

  // Fetch events on mount and whenever search/category changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleCategoryClick = (cat) => {
    setCategory(cat === 'All' ? '' : cat);
  };

  const handleBook = async (eventId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      toast.error('Admins manage events and approvals only');
      return;
    }

    setBookingEventId(eventId);
    try {
      const response = await api.post('/bookings', { eventId, seats: 1 });
      toast.success(response.data.message || 'Booking created');
      navigate('/my-bookings');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Booking failed'));
      setBookingEventId('');
    }
  };

  return (
    <div className="container">
      <h2 style={styles.pageTitle}>All Events</h2>

      <div style={styles.filterBar}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            className="form-input"
            style={{ marginBottom: 0, flex: 1 }}
            placeholder="Search events or locations..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
          {search && (
            <button
              type="button"
              style={styles.clearBtn}
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </form>

        <div style={styles.chips}>
          {CATEGORIES.map((cat) => {
            const active = (cat === 'All' && !category) || cat === category;
            const color = CATEGORY_COLORS[cat] || '#6b7280';
            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  ...styles.chip,
                  ...(active ? { background: color, color: '#fff', borderColor: color } : {}),
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p style={{ color: 'var(--error-fg)', marginBottom: '16px' }}>{error}</p>}

      {loading && (
        <div className="spinner-wrap"><div className="spinner" /></div>
      )}

      {!loading && events.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">Search</div>
          <h3>No events found</h3>
          <p>{search || category ? 'Try changing your search or filter.' : 'No events available right now.'}</p>
          {(search || category) && (
            <button
              style={{ ...styles.searchBtn, marginTop: '16px', padding: '8px 20px' }}
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setCategory('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={styles.eventList}>
          {events.map((event) => {
            const isBusy = bookingEventId === event._id;
            const isFull = event.availableSeats <= 0;
            const catColor = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Other;

            return (
              <div key={event._id} style={styles.card} className="card-hover">
                {event.image ? (
                  <img
                    src={resolveAssetUrl(event.image)}
                    alt={event.title}
                    style={styles.cardImg}
                  />
                ) : (
                  <div style={{ ...styles.cardImgPlaceholder, background: `${catColor}18` }}>
                    <span style={{ fontSize: '0.9rem', opacity: 0.6, fontWeight: '700' }}>EVENT</span>
                  </div>
                )}

                <div style={styles.cardBody}>
                  <div style={styles.cardTopRow}>
                    <span style={{ ...styles.catChip, background: `${catColor}18`, color: catColor }}>
                      {event.category}
                    </span>
                    <span style={{ fontWeight: '700', color: event.price === 0 ? 'var(--success-fg)' : 'var(--text)', fontSize: '0.95rem' }}>
                      {event.price === 0 ? 'Free' : `Rs ${event.price}`}
                    </span>
                  </div>

                  <h3 style={styles.cardTitle}>{event.title}</h3>

                  <div style={styles.metaRow}>
                    <span style={styles.meta}>Date: {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span style={styles.meta}>&nbsp;&nbsp;|&nbsp;&nbsp;Time: {event.time}</span>
                  </div>
                  <p style={styles.meta}>Location: {event.location}</p>

                  <div style={styles.cardFooter}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: isFull ? 'var(--error-fg)' : 'var(--success-fg)', fontSize: '0.82rem', fontWeight: '600' }}>
                        {isFull ? 'Sold Out' : `${event.availableSeats} seats left`}
                      </span>
                      <span style={styles.approvalBadge}>
                        {event.approvalRequired ? 'Approval required' : 'Instant confirm'}
                      </span>
                    </div>

                    <div style={styles.actionGroup}>
                      <Link to={`/events/${event._id}`} style={styles.detailsBtn}>Details</Link>
                      {user?.role !== 'admin' && (
                        <button
                          style={{ ...styles.bookBtn, ...(isFull ? styles.bookBtnDisabled : {}) }}
                          onClick={() => handleBook(event._id)}
                          disabled={isBusy || isFull}
                        >
                          {isBusy ? 'Booking...' : isFull ? 'Full' : 'Book 1 Seat'}
                        </button>
                      )}
                    </div>
                  </div>
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
  pageTitle: { fontSize: '1.5rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text)' },
  filterBar: { marginBottom: '24px' },
  searchForm: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' },
  searchBtn: {
    padding: '10px 18px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  clearBtn: {
    padding: '10px 14px',
    background: 'var(--neutral-bg)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  chips: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: {
    padding: '5px 14px',
    borderRadius: '999px',
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: '600',
    transition: 'all 0.15s',
  },
  eventList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    display: 'flex',
    gap: '0',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  cardImg: { width: '160px', flexShrink: 0, objectFit: 'cover', display: 'block' },
  cardImgPlaceholder: {
    width: '160px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: '16px', minWidth: '240px' },
  cardTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  catChip: { padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' },
  cardTitle: { fontSize: '1.05rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text)', lineHeight: '1.35' },
  metaRow: { display: 'flex', flexWrap: 'wrap' },
  meta: { color: 'var(--text-muted)', fontSize: '0.83rem', margin: '2px 0' },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
    gap: '12px',
    flexWrap: 'wrap',
  },
  approvalBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '999px',
    background: 'var(--neutral-bg)',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  actionGroup: { display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 },
  detailsBtn: {
    padding: '6px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text)',
    background: 'var(--surface)',
  },
  bookBtn: {
    padding: '6px 18px',
    borderRadius: '8px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  bookBtnDisabled: { background: 'var(--neutral-bg)', color: 'var(--text-muted)', cursor: 'not-allowed' },
};
