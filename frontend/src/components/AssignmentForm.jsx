import { useState } from 'react'
import './forms.css'

function toFormState(assignment, prefillRange) {
  if (assignment) {
    return {
      tenantName: assignment.tenantName,
      channelsAssigned: String(assignment.channelsAssigned),
      didRanges: (assignment.didRanges || []).map((r) => ({ start: String(r.start), end: String(r.end) })),
      notes: assignment.notes || '',
    }
  }
  return {
    tenantName: '',
    channelsAssigned: '',
    didRanges: [prefillRange ? { start: String(prefillRange.start), end: String(prefillRange.end) } : { start: '', end: '' }],
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

  function setRange(index, key, value) {
    setForm((f) => {
      const ranges = f.didRanges.slice()
      ranges[index] = { ...ranges[index], [key]: value }
      return { ...f, didRanges: ranges }
    })
  }

  function addRange() {
    setForm((f) => ({ ...f, didRanges: [...f.didRanges, { start: '', end: '' }] }))
  }

  function removeRange(index) {
    setForm((f) => ({ ...f, didRanges: f.didRanges.filter((_, i) => i !== index) }))
  }

  // Clicking a free-range chip fills the last empty row if there is one,
  // otherwise adds a new row — so picking several blocks for one tenant is
  // just a couple of clicks.
  function pickRange(r) {
    setForm((f) => {
      const ranges = f.didRanges.slice()
      const last = ranges[ranges.length - 1]
      if (last && !last.start && !last.end) {
        ranges[ranges.length - 1] = { start: String(r.start), end: String(r.end) }
      } else {
        ranges.push({ start: String(r.start), end: String(r.end) })
      }
      return { ...f, didRanges: ranges }
    })
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    const didRanges = form.didRanges.map((r) => ({ start: Number(r.start), end: Number(r.end) }))

    const payload = {
      tenantName: form.tenantName.trim(),
      channelsAssigned: Number(form.channelsAssigned),
      didRanges,
      notes: form.notes.trim(),
    }

    if (!payload.tenantName) return setError('Tenant name is required.')
    if (!payload.channelsAssigned) return setError('Enter number of channels to assign.')
    if (didRanges.length === 0) return setError('Add at least one DID range.')
    for (const r of didRanges) {
      if (!r.start || !r.end) return setError('Fill in every DID range (start and end).')
      if (r.start > r.end) return setError('Each DID range\'s start must come before its end.')
    }
    const sorted = [...didRanges].sort((a, b) => a.start - b.start)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start <= sorted[i - 1].end) {
        return setError(`DID ranges overlap: ${sorted[i - 1].start}–${sorted[i - 1].end} and ${sorted[i].start}–${sorted[i].end}.`)
      }
    }

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
          <span className="free-ranges__label">Available DIDs — click to add a block</span>
          <div className="free-ranges__chips">
            {freeRanges.map((r, i) => (
              <button
                type="button"
                key={i}
                className="free-ranges__chip mono"
                onClick={() => pickRange(r)}
                title="Add this whole block"
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
      </div>

      <div className="ranges">
        <div className="ranges__head">
          <span>DID ranges</span>
        </div>

        {form.didRanges.map((r, i) => (
          <div className="ranges__row" key={i}>
            <input
              className="mono"
              type="number"
              value={r.start}
              onChange={(e) => setRange(i, 'start', e.target.value)}
              placeholder="e.g. 1201"
            />
            <span className="ranges__dash">–</span>
            <input
              className="mono"
              type="number"
              value={r.end}
              onChange={(e) => setRange(i, 'end', e.target.value)}
              placeholder="e.g. 1499"
            />
            <button
              type="button"
              className="ranges__remove"
              onClick={() => removeRange(i)}
              disabled={form.didRanges.length === 1}
              title="Remove this range"
            >
              ×
            </button>
          </div>
        ))}

        <button type="button" className="btn btn--ghost ranges__add" onClick={addRange}>+ Add another DID range</button>
      </div>

      <div className="form__grid" style={{ marginTop: 14 }}>
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
