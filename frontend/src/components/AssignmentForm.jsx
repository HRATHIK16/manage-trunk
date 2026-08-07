import { useState } from 'react'
import './forms.css'

function toFormState(assignment) {
  if (!assignment) return { tenantName: '', channelsAssigned: '', didStart: '', didEnd: '', notes: '' }
  return {
    tenantName: assignment.tenantName,
    channelsAssigned: String(assignment.channelsAssigned),
    didStart: String(assignment.didStart),
    didEnd: String(assignment.didEnd),
    notes: assignment.notes || '',
  }
}

export default function AssignmentForm({ initial = null, onSubmit, onCancel, channelsFree, didFloor, didCeil }) {
  const editing = Boolean(initial)
  const [form, setForm] = useState(() => toFormState(initial))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    const payload = {
      tenantName: form.tenantName.trim(),
      channelsAssigned: Number(form.channelsAssigned),
      didStart: Number(form.didStart),
      didEnd: Number(form.didEnd),
      notes: form.notes.trim(),
    }

    if (!payload.tenantName) return setError('Tenant name is required.')
    if (!payload.channelsAssigned) return setError('Enter number of channels to assign.')
    if (!payload.didStart || !payload.didEnd) return setError('Enter a DID range for this tenant.')
    if (payload.didStart > payload.didEnd) return setError('DID start must come before DID end.')

    setBusy(true)
    try {
      await onSubmit(payload)
      if (!editing) setForm(toFormState(null))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel form form--compact" onSubmit={submit}>
      <div className="form__header">
        <h3>{editing ? `Edit ${initial.tenantName}'s assignment` : 'Assign to tenant'}</h3>
        <span className="hint">{channelsFree} channel{channelsFree === 1 ? '' : 's'} free · DIDs {didFloor}–{didCeil}</span>
      </div>

      <div className="form__grid">
        <label className="field">
          <span>Tenant name</span>
          <input value={form.tenantName} onChange={(e) => set('tenantName', e.target.value)} placeholder="Acme Corp" />
        </label>

        <label className="field">
          <span>Channels</span>
          <input
            className="mono"
            type="number"
            min="1"
            value={form.channelsAssigned}
            onChange={(e) => set('channelsAssigned', e.target.value)}
            placeholder="2"
          />
        </label>

        <label className="field">
          <span>DID start</span>
          <input
            className="mono"
            type="number"
            value={form.didStart}
            onChange={(e) => set('didStart', e.target.value)}
            placeholder={String(didFloor)}
          />
        </label>

        <label className="field">
          <span>DID end</span>
          <input
            className="mono"
            type="number"
            value={form.didEnd}
            onChange={(e) => set('didEnd', e.target.value)}
            placeholder={String(didFloor)}
          />
        </label>

        <label className="field field--wide">
          <span>Notes (optional)</span>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contact, ticket ref, etc." />
        </label>
      </div>

      {error && <div className="form__error">{error}</div>}

      <div className="form__actions">
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Assign'}
        </button>
        {editing && <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  )
}
