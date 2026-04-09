export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  const toneStyles = tone === 'danger'
    ? {
        confirmBackground: 'var(--error-fg)',
        confirmColor: '#fff',
      }
    : {
        confirmBackground: 'var(--primary)',
        confirmColor: 'var(--primary-fg)',
      };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div style={styles.card}>
        <h3 id="confirm-modal-title" style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{ ...styles.confirmBtn, background: toneStyles.confirmBackground, color: toneStyles.confirmColor }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1200,
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-md)',
    padding: '24px',
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--text)',
    marginBottom: '8px',
  },
  message: {
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
    lineHeight: '1.6',
    marginBottom: '18px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: '600',
  },
  confirmBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
  },
};
