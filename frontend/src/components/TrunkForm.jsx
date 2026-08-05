import { useState } from 'react'
import './forms.css'

const empty = {
  name: '',
  environment: 'lab',
  pilotNumber: '',
  didStart: '',
  didEnd: '',
  totalChannels: '',
  cps: '',
  notes: '',
}

export default function TrunkForm({ onCreate, onCancel }) {
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')

    const payload = {
      name: form.name.trim(),
      environment: form.environment,
      pilotNumber: form.pilotNumber.trim(),
      didStart: Number(form.didStart),
      didEnd: Number(form.didEnd),
      totalChannels: Number(form.totalChannels),
      cps: Number(form.cps),
      notes: form.notes.trim(),
    }

    if (!payload.name) return setError('Give the trunk a name.')
    if (!payload.pilotNumber) return setError('Pilot number is required.')
    if (!payload.didStart || !payload.didEnd) return setError('Enter a DID range.')
    if (payload.didStart > payload.didEnd) return setError('DID start must come before DID end.')
    if (!payload.totalChannels) return setError('Enter total channel count.')
    if (!payload.cps) return setError('Enter a CPS (calls per second) limit.')

    setBusy(true)
    try {
      await onCreate(payload)
      setForm(empty)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <div className="form__header">
        <h2>New SIP trunk</h2>
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
            <option value="lab">Lab</option>
            <option value="prod">Prod</option>
            <option value="staging">Staging</option>
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
          <span>DID range — start</span>
          <input
            className="mono"
            type="number"
            value={form.didStart}
            onChange={(e) => set('didStart', e.target.value)}
            placeholder="918041234000"
          />
        </label>

        <label className="field">
          <span>DID range — end</span>
          <input
            className="mono"
            type="number"
            value={form.didEnd}
            onChange={(e) => set('didEnd', e.target.value)}
            placeholder="918041234999"
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

        <label className="field field--wide">
          <span>Notes (optional)</span>
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Carrier, SBC peer, contact, etc." />
        </label>
      </div>

      {error && <div className="form__error">{error}</div>}

      <div className="form__actions">
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create trunk'}
        </button>
      </div>
    </form>
  )
}
