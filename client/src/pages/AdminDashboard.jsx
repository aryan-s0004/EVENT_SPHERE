import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

const CATEGORIES = ['Music', 'Tech', 'Sports', 'Art', 'Food', 'Business', 'Other'];

const BOOKING_STATUS = {
  pending: { label: 'Waiting for approval', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  approved: { label: 'Confirmed', bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
  rejected: { label: 'Declined', bg: 'var(--error-bg)', fg: 'var(--error-fg)' },
  cancelled: { label: 'Cancelled', bg: 'var(--neutral-bg)', fg: 'var(--neutral-fg)' },
};

export default function AdminDashboard() {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [actionKey, setActionKey] = useState('');
  const [eventToDelete, setEventToDelete] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'Tech',
    totalSeats: 100,
    price: 0,
    tags: '',
  });
  const [image, setImage] = useState(null);

  const fetchDashboardData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [eventsRes, bookingsRes] = await Promise.all([
        api.get('/events/admin/all'),
        api.get('/bookings/admin/all'),
      ]);
      setEvents(eventsRes.data.events || []);
      setBookings(bookingsRes.data.bookings || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load dashboard'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const id = window.setInterval(() => fetchDashboardData({ silent: true }), 5000);
    return () => window.clearInterval(id);
  }, []);

  const handleStatus = async (id, status) => {
    setActionKey(`event-status-${id}-${status}`);
    try {
      const res = await api.patch(`/events/admin/${id}/status`, { status });
      toast.success(`Event ${res.data.event?.status || 'updated'}`);
      await fetchDashboardData({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update event status'));
    } finally {
      setActionKey('');
    }
  };

  const handleDelete = async (id) => {
    setActionKey(`event-delete-${id}`);
    try {
      const res = await api.delete(`/events/${id}`);
      toast.success(res.data.message || 'Event deleted');
      await fetchDashboardData({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to delete event'));
    } finally {
      setActionKey('');
      setEventToDelete(null);
    }
  };

  const handleBookingAction = async (id, status) => {
    setActionKey(`booking-${id}-${status}`);
    try {
      const res = await api.patch(`/bookings/admin/${id}/status`, { status });
      toast.success(res.data.message || `Booking ${status}`);
      await fetchDashboardData({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update booking'));
    } finally {
      setActionKey('');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditEvent(null);
    setImage(null);
    setForm({
      title: '',
      description: '',
      date: '',
      time: '',
      location: '',
      category: 'Tech',
      totalSeats: 100,
      price: 0,
      tags: '',
    });
  };

  const openEdit = (event) => {
    setEditEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date?.split('T')[0],
      time: event.time,
      location: event.location,
      category: event.category,
      totalSeats: event.totalSeats,
      price: event.price,
      tags: event.tags?.join(', ') || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionKey('event-save');
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    if (image) formData.append('image', image);

    try {
      if (editEvent) {
        await api.put(`/events/${editEvent._id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Event updated');
      } else {
        await api.post('/events', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Event created');
      }
      resetForm();
      await fetchDashboardData({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to save event'));
    } finally {
      setActionKey('');
    }
  };

  const stats = [
    { label: 'Total Events', value: events.length, color: 'var(--accent)' },
    { label: 'Active Events', value: events.filter((e) => e.status === 'active').length, color: 'var(--success-fg)' },
    { label: 'Total Bookings', value: bookings.length, color: 'var(--primary)' },
    { label: 'Pending Approval', value: bookings.filter((b) => b.status === 'pending').length, color: 'var(--warning-fg)' },
  ];

  return (
    <div className="container">
      <h2 style={styles.pageTitle}>Admin Dashboard</h2>
      <ConfirmModal
        open={Boolean(eventToDelete)}
        title="Delete event?"
        message="Are you sure you want to permanently delete this event and all of its related bookings?"
        confirmLabel="Yes, delete event"
        cancelLabel="Keep event"
        busy={actionKey === `event-delete-${eventToDelete}`}
        onCancel={() => setEventToDelete(null)}
        onConfirm={() => handleDelete(eventToDelete)}
      />

      {!loading && (
        <div style={styles.statsGrid}>
          {stats.map(({ label, value, color }) => (
            <div key={label} style={styles.statCard}>
              <div style={{ ...styles.statValue, color }}>{value}</div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.tabRow}>
        <div style={styles.tabs}>
          {['events', 'bookings'].map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'bookings' && bookings.filter((b) => b.status === 'pending').length > 0 && (
                <span style={styles.pendingDot}>
                  {bookings.filter((b) => b.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button style={styles.addBtn} onClick={() => { resetForm(); setShowForm(true); }}>
          + Add Event
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>{editEvent ? 'Edit Event' : 'New Event'}</h3>
          <p style={styles.helperText}>
            Events are created as <strong>active</strong> immediately. Free events confirm instantly, while paid events wait for admin approval.
          </p>
          <form onSubmit={handleSubmit} style={styles.formGrid}>
            <div>
              <label style={styles.formLabel}>Title *</label>
              <input className="form-input" style={{ marginBottom: 0 }} placeholder="Event title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Location *</label>
              <input className="form-input" style={{ marginBottom: 0 }} placeholder="Venue / room" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Date *</label>
              <input type="date" className="form-input" style={{ marginBottom: 0 }} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Time *</label>
              <input className="form-input" style={{ marginBottom: 0 }} placeholder="e.g. 6:00 PM" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Total Seats *</label>
              <input type="number" className="form-input" style={{ marginBottom: 0 }} placeholder="100" required min="1" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Price (0 = Free)</label>
              <input type="number" className="form-input" style={{ marginBottom: 0 }} placeholder="0" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label style={styles.formLabel}>Category</label>
              <select className="form-input" style={{ marginBottom: 0 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.formLabel}>Tags (comma-separated)</label>
              <input className="form-input" style={{ marginBottom: 0 }} placeholder="e.g. networking, workshop" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={styles.formLabel}>Description *</label>
              <textarea className="form-input" style={{ marginBottom: 0, minHeight: '90px', resize: 'vertical' }} placeholder="Event description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={styles.formLabel}>Event Image</label>
              <input type="file" accept="image/*" className="form-input" style={{ marginBottom: 0 }} onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...styles.checkRow }}>
                <input
                  type="checkbox"
                  checked={Number(form.price) > 0}
                  disabled
                  readOnly
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
                  Paid events will require admin approval automatically
                </span>
              </label>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={styles.saveBtn} type="submit" disabled={actionKey === 'event-save'}>
                {actionKey === 'event-save' ? 'Saving...' : editEvent ? 'Update Event' : 'Create Event'}
              </button>
              <button style={styles.cancelFormBtn} type="button" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {!loading && tab === 'events' && (
        <>
          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">Events</div>
              <h3>No events yet</h3>
              <p>Click "+ Add Event" to create the first event.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: 'var(--surface-alt)' }}>
                    {['Title', 'Date', 'Category', 'Seats', 'Price', 'Approval', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event._id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: '600', color: 'var(--text)', maxWidth: '200px' }}>{event.title}</td>
                      <td style={styles.td}>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={styles.td}>{event.category}</td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: '600', color: event.availableSeats === 0 ? 'var(--error-fg)' : 'var(--success-fg)' }}>
                          {event.availableSeats}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>/{event.totalSeats}</span>
                      </td>
                      <td style={styles.td}>{event.price === 0 ? <span style={{ color: 'var(--success-fg)', fontWeight: '600' }}>Free</span> : `Rs ${event.price}`}</td>
                      <td style={styles.td}>
                        <span style={{ fontSize: '0.8rem', color: event.approvalRequired ? 'var(--warning-fg)' : 'var(--success-fg)', fontWeight: '600' }}>
                          {event.approvalRequired ? 'Required' : 'Instant'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusChip,
                          background: event.status === 'active' ? 'var(--success-bg)' : 'var(--neutral-bg)',
                          color: event.status === 'active' ? 'var(--success-fg)' : 'var(--neutral-fg)',
                        }}>
                          {event.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                        <button
                          style={event.status === 'inactive' ? styles.activateBtn : styles.deactivateBtn}
                          onClick={() => handleStatus(event._id, event.status === 'active' ? 'inactive' : 'active')}
                          disabled={actionKey.startsWith(`event-status-${event._id}`)}
                        >
                          {event.status === 'inactive' ? 'Activate' : 'Deactivate'}
                        </button>
                        <button style={styles.editBtn} onClick={() => openEdit(event)}>Edit</button>
                        <button
                          style={styles.deleteBtn}
                          onClick={() => setEventToDelete(event._id)}
                          disabled={actionKey === `event-delete-${event._id}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'bookings' && (
        <>
          {bookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">Bookings</div>
              <h3>No bookings yet</h3>
              <p>Bookings will appear here once users start booking events.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: 'var(--surface-alt)' }}>
                    {['User', 'Event', 'Seats', 'Total', 'Status', 'Booked On', 'Actions'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const cfg = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
                    return (
                      <tr key={booking._id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '600', color: 'var(--text)' }}>{booking.user?.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{booking.user?.email}</div>
                        </td>
                        <td style={{ ...styles.td, maxWidth: '180px', color: 'var(--text)' }}>{booking.event?.title || <em style={{ color: 'var(--text-muted)' }}>Event removed</em>}</td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{booking.seats}</td>
                        <td style={styles.td}>{booking.totalPrice > 0 ? `Rs ${booking.totalPrice}` : <span style={{ color: 'var(--success-fg)', fontWeight: '600' }}>Free</span>}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusChip, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
                        </td>
                        <td style={styles.td}>{new Date(booking.createdAt).toLocaleDateString('en-IN')}</td>
                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                          {booking.status === 'pending' ? (
                            <>
                              <button
                                style={styles.approveBtn}
                                onClick={() => handleBookingAction(booking._id, 'approved')}
                                disabled={actionKey === `booking-${booking._id}-approved`}
                              >
                                Approve
                              </button>
                              <button
                                style={styles.rejectBtn}
                                onClick={() => handleBookingAction(booking._id, 'rejected')}
                                disabled={actionKey === `booking-${booking._id}-rejected`}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  pageTitle: { fontSize: '1.5rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text)' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px 18px',
    boxShadow: 'var(--shadow-sm)',
  },
  statValue: { fontSize: '2rem', fontWeight: '800', lineHeight: 1, marginBottom: '6px' },
  statLabel: { fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '500' },
  tabRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  tabs: { display: 'flex', gap: '8px' },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 18px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  tabActive: {
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    borderColor: 'var(--primary)',
  },
  pendingDot: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 5px',
    borderRadius: '999px',
    background: 'var(--warning-fg)',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: '800',
  },
  addBtn: {
    padding: '8px 18px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '700',
  },
  formCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: 'var(--shadow-sm)',
  },
  formTitle: { fontSize: '1.1rem', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' },
  helperText: { color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '20px', lineHeight: '1.5' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  formLabel: { display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text)', marginBottom: '5px' },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 24px',
    background: 'var(--primary)',
    color: 'var(--primary-fg)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
  cancelFormBtn: {
    padding: '9px 20px',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', background: 'var(--surface)' },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    fontWeight: '700',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.15s' },
  td: { padding: '12px 14px', color: 'var(--text-muted)', verticalAlign: 'middle' },
  statusChip: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  activateBtn: {
    padding: '4px 10px',
    background: 'var(--success-bg)',
    color: 'var(--success-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    marginRight: '4px',
  },
  deactivateBtn: {
    padding: '4px 10px',
    background: 'var(--neutral-bg)',
    color: 'var(--neutral-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    marginRight: '4px',
  },
  editBtn: {
    padding: '4px 10px',
    background: 'var(--warning-bg)',
    color: 'var(--warning-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    marginRight: '4px',
  },
  deleteBtn: {
    padding: '4px 10px',
    background: 'var(--error-bg)',
    color: 'var(--error-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  approveBtn: {
    padding: '4px 10px',
    background: 'var(--success-bg)',
    color: 'var(--success-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    marginRight: '4px',
  },
  rejectBtn: {
    padding: '4px 10px',
    background: 'var(--error-bg)',
    color: 'var(--error-fg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
};
