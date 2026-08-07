import { useState } from 'react'
import './forms.css'

function toFormState(assignment, prefillRange) {
  if (assignment) {
    return {
      tenantName: assignment.tenantName,
      channelsAssigned: String(assignment.channelsAssigned),
      didStart: String(assignment.didStart),
      didEnd: String(assignment.didEnd),
      notes: assignment.notes || '',
    }
  }
  return {
    tenantName: '',
    channelsAssigned: '',
    didStart: prefillRange ? String(prefillRange.start) : '',
    didEnd: prefillRange ? String(prefillRange.end) : '',
    notes: '',
  }
}

export default function AssignmentForm({ initial = null, prefillRange = null, onSubmit, onCancel, channelsFree, freeRanges = [] }) {
  const editing = Boolean(initial)
  const [form, setForm] = useState(() => toFormState(initial, prefillRange))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function pickRange(r) {
    setForm((f) => ({ ...f, didStart: String(r.start), didEnd: String(r.end) }))
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
      if (!editing) setForm(toFormState(null, null))
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
        <span className="hint">{channelsFree} channel{channelsFree === 1 ? '' : 's'} free</span>
      </div>

      {freeRanges.length > 0 && (
        <div className="free-ranges">
          <span className="free-ranges__label">Available DIDs</span>
          <div className="free-ranges__chips">
            {freeRanges.map((r, i) => (
              <button
                type="button"
                key={i}
                className="free-ranges__chip mono"
                onClick={() => pickRange(r)}
                title="Use this whole block"
              >
                {r.start}–{r.end}
                <span className="free-ranges__chip-count">{(r.end - r.start + 1).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
            placeholder="e.g. 1201"
          />
        </label>

        <label className="field">
          <span>DID end</span>
          <input
            className="mono"
            type="number"
            value={form.didEnd}
            onChange={(e) => set('didEnd', e.target.value)}
            placeholder="e.g. 1499"
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
