import { useState } from 'react'
import './forms.css'

function toFormState(trunk) {
  if (!trunk) {
    return {
      name: '',
      environment: 'prod',
      pilotNumber: '',
      didRanges: [{ start: '', end: '' }],
      totalChannels: '',
      cps: '',
      notes: '',
    }
  }
  return {
    name: trunk.name,
    environment: trunk.environment,
    pilotNumber: trunk.pilotNumber,
    didRanges: (trunk.didRanges || []).map((r) => ({ start: String(r.start), end: String(r.end) })),
    totalChannels: String(trunk.totalChannels),
    cps: String(trunk.cps),
    notes: trunk.notes || '',
  }
}

export default function TrunkForm({ initial = null, onSubmit, onCancel }) {
  const editing = Boolean(initial)
  const [form, setForm] = useState(() => toFormState(initial))
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

  async function submit(e) {
    e.preventDefault()
    setError('')

    const didRanges = form.didRanges.map((r) => ({ start: Number(r.start), end: Number(r.end) }))

    const payload = {
      name: form.name.trim(),
      environment: form.environment,
      pilotNumber: form.pilotNumber.trim(),
      didRanges,
      totalChannels: Number(form.totalChannels),
      cps: Number(form.cps),
      notes: form.notes.trim(),
    }

    if (!payload.name) return setError('Give the trunk a name.')
    if (!payload.pilotNumber) return setError('Pilot number is required.')
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
    if (!payload.totalChannels) return setError('Enter total channel count.')
    if (!payload.cps) return setError('Enter a CPS (calls per second) limit.')

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
    <form className="panel form" onSubmit={submit}>
      <div className="form__header">
        <h2>{editing ? 'Edit trunk' : 'New SIP trunk'}</h2>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>

      <div className="form__grid">
        <label className="field">
          <span>Trunk name</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Airtel-Prod-01" />
        </label>

        <label className="field">
          <span>Environment</span>
          <select value={form.environment} onChange={(e) => set('environment', e.target.value)}>
            <option value="prod">Prod</option>
            <option value="lab">Lab</option>
          </select>
        </label>

        <label className="field">
          <span>Pilot number</span>
          <input
            className="mono"
            value={form.pilotNumber}
            onChange={(e) => set('pilotNumber', e.target.value)}
            placeholder="918041234500"
          />
        </label>

        <label className="field">
          <span>Total channels</span>
          <input
            className="mono"
            type="number"
            min="1"
            value={form.totalChannels}
            onChange={(e) => set('totalChannels', e.target.value)}
            placeholder="20"
          />
        </label>

        <label className="field">
          <span>CPS limit</span>
          <input
            className="mono"
            type="number"
            min="1"
            value={form.cps}
            onChange={(e) => set('cps', e.target.value)}
            placeholder="5"
          />
        </label>
      </div>

      <div className="ranges">
        <div className="ranges__head">
          <span>DID ranges</span>
          <span className="hint">Most trunks have one — add more if this trunk has separate blocks.</span>
        </div>

        {form.didRanges.map((r, i) => (
          <div className="ranges__row" key={i}>
            <input
              className="mono"
              type="number"
              value={r.start}
              onChange={(e) => setRange(i, 'start', e.target.value)}
              placeholder="918041234000"
            />
            <span className="ranges__dash">–</span>
            <input
              className="mono"
              type="number"
              value={r.end}
              onChange={(e) => setRange(i, 'end', e.target.value)}
              placeholder="918041234999"
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
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Carrier, SBC peer, contact, etc." />
        </label>
      </div>

      {error && <div className="form__error">{error}</div>}

      <div className="form__actions">
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create trunk'}
        </button>
      </div>
    </form>
  )
}
