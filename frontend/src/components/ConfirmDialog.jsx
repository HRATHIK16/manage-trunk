import './modal.css'

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        <p className="modal__message">{message}</p>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className={danger ? 'btn btn--danger-solid' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
