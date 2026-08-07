import { useRef, useState } from 'react'
import { api } from '../api'
import ConfirmDialog from './ConfirmDialog'
import './modal.css'

export default function BackupPanel({ onClose, onRestored }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingFile, setPendingFile] = useState(null) // { name, text }

  async function handleDownload() {
    setError('')
    setBusy(true)
    try {
      await api.downloadBackup()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingFile({ name: file.name, text: reader.result })
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
  }

  async function confirmRestore() {
    setBusy(true)
    setError('')
    try {
      await api.restore(pendingFile.text)
      setPendingFile(null)
      onRestored?.()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">Backup &amp; restore</h3>
        <p className="modal__message">
          Download a full snapshot (trunks, tenant assignments, and activity history) any time — keep a copy
          somewhere safe. If this VM is ever lost, restoring that file on a fresh deployment picks up right
          where you left off.
        </p>

        <div className="backup__row">
          <div>
            <div className="backup__label">Download a snapshot</div>
            <div className="backup__hint">Saves a dated .json file to your downloads folder.</div>
          </div>
          <button className="btn btn--primary" onClick={handleDownload} disabled={busy}>
            {busy ? 'Working…' : 'Download backup'}
          </button>
        </div>

        <div className="backup__row">
          <div>
            <div className="backup__label">Restore from a snapshot</div>
            <div className="backup__hint">Replaces all current trunks and assignments with the file's contents.</div>
          </div>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Choose file…
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleFileChosen} />
        </div>

        {error && <div className="form__error">{error}</div>}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      {pendingFile && (
        <ConfirmDialog
          title="Restore from backup?"
          message={`This replaces everything currently in Trunkline with the contents of "${pendingFile.name}". This can't be undone.`}
          confirmLabel="Restore"
          danger
          busy={busy}
          onConfirm={(e) => { e.stopPropagation(); confirmRestore() }}
          onCancel={(e) => { e?.stopPropagation?.(); setPendingFile(null) }}
        />
      )}
    </div>
  )
}
