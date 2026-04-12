import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

const HOME_STATS = [
  { label: 'Upcoming Events', getValue: ({ loading, totalEvents, eventCount }) => (loading ? '...' : String(totalEvents || eventCount)) },
  { label: 'Featured Now', getValue: ({ loading, eventCount }) => (loading ? '...' : String(eventCount)) },
  { label: 'Booking Modes', getValue: () => 'Free / Paid' },
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/events?limit=6')
      .then((r) => {
        if (active) {
          setEvents(r.data.events || []);
          setTotalEvents(r.data.total || 0);
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, 'Unable to load events right now'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>Live Event Platform</div>
          <h1 style={styles.heroTitle}>Discover &amp; Book<br />Events Near You</h1>
          <p style={styles.heroSub}>
            From tech conferences to sports championships, find, book, and manage events all in one place.
          </p>
          <div style={styles.heroActions}>
            <Link to="/events" style={styles.ctaPrimary}>Browse All Events</Link>
          </div>
        </div>
      </div>

      <div className="container">
        <div style={styles.statsBar} className="glass">
          {HOME_STATS.map(({ label, getValue }) => (
            <div key={label} style={styles.statItem}>
              <div style={styles.statValue}>
                {getValue({ loading, totalEvents, eventCount: events.length })}
              </div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        <h2 style={styles.sectionTitle}>Upcoming Events</h2>

        {loading && (
          <div className="spinner-wrap"><div className="spinner" /></div>
        )}
        {!loading && error && <p style={{ color: 'var(--error-fg)', marginBottom: '16px' }}>{error}</p>}
        {!loading && !error && events.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">Events</div>
            <h3>No events yet</h3>
            <p>Check back soon. New events are added regularly.</p>
          </div>
        )}

        {!loading && !error && (
          <div style={styles.grid}>
            {events.map((event) => {
              const catColor = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Other;
              return (
                <Link to={`/events/${event._id}`} key={event._id} style={styles.card} className="card-hover">
                  {event.image ? (
                    <img
                      src={resolveAssetUrl(event.image)}
                      alt={event.title}
                      style={styles.cardImg}
                    />
                  ) : (
                    <div style={{ ...styles.cardImgPlaceholder, background: `${catColor}22` }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                        {event.category === 'Sports' ? 'SPORT' : event.category === 'Music' ? 'MUSIC' : event.category === 'Food' ? 'FOOD' : 'EVENT'}
                      </span>
                    </div>
                  )}
                  <div style={styles.cardBody}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ ...styles.catBadge, background: `${catColor}18`, color: catColor }}>
                        {event.category}
                      </span>
                      <span style={styles.cardPrice}>
                        {event.price === 0 ? 'Free' : `Rs ${event.price}`}
                      </span>
                    </div>
                    <h3 style={styles.cardTitle}>{event.title}</h3>
                    <p style={styles.cardMeta}>Date: {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p style={styles.cardMeta}>Location: {event.location}</p>
                    <div style={styles.cardFooter}>
                      <span style={{ color: event.availableSeats > 0 ? 'var(--success-fg)' : 'var(--error-fg)', fontSize: '0.8rem', fontWeight: '600' }}>
                        {event.availableSeats > 0 ? `${event.availableSeats} seats left` : 'Sold Out'}
                      </span>
                      <span style={styles.viewLink}>View details</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && events.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <Link to="/events" style={styles.seeAllBtn}>See All Events</Link>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  hero: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
    padding: '70px 20px',
    textAlign: 'center',
  },
  heroInner: { maxWidth: '640px', margin: '0 auto' },
  heroBadge: {
    display: 'inline-block',
    padding: '4px 14px',
    background: 'rgba(59,130,246,0.25)',
    color: '#93c5fd',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '18px',
    letterSpacing: '0.5px',
    border: '1px solid rgba(59,130,246,0.3)',
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 2.8rem)',
    fontWeight: '800',
    color: '#f1f5f9',
    lineHeight: '1.15',
    marginBottom: '16px',
    letterSpacing: '-0.5px',
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: '1.05rem',
    marginBottom: '32px',
    lineHeight: '1.7',
    maxWidth: '500px',
    margin: '0 auto 32px',
  },
  heroActions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  ctaPrimary: {
    padding: '12px 28px',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.95rem',
    transition: 'background 0.2s',
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1px',
    background: 'var(--border)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    overflow: 'hidden',
    margin: '28px auto 40px',
    maxWidth: '1040px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
  },
  statItem: {
    padding: '22px 18px',
    minHeight: '104px',
    textAlign: 'center',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 'clamp(1.1rem, 2vw, 1.75rem)',
    fontWeight: '800',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    lineHeight: '1.2',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '7px',
    fontWeight: '600',
    lineHeight: '1.35',
  },
  sectionTitle: {
    fontSize: '1.3rem',
    fontWeight: '700',
    marginBottom: '20px',
    color: 'var(--text)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    display: 'block',
    color: 'var(--text)',
    transition: 'box-shadow 0.2s, transform 0.15s',
  },
  cardImg: { width: '100%', height: '160px', objectFit: 'cover' },
  cardImgPlaceholder: {
    width: '100%',
    height: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: '16px' },
  catBadge: {
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  cardPrice: { fontWeight: '700', color: 'var(--success-fg)', fontSize: '0.95rem' },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    margin: '10px 0 6px',
    lineHeight: '1.35',
    color: 'var(--text)',
  },
  cardMeta: { color: 'var(--text-muted)', fontSize: '0.82rem', margin: '3px 0' },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
  },
  viewLink: {
    fontSize: '0.85rem',
    color: 'var(--accent)',
    fontWeight: '600',
  },
  seeAllBtn: {
    display: 'inline-block',
    padding: '10px 24px',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontWeight: '600',
    fontSize: '0.9rem',
    background: 'var(--surface)',
  },
};
