import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import JackBar, { tenantColor } from './JackBar'
import AssignmentForm from './AssignmentForm'
import './TrunkDetail.css'

function fmtDID(n) {
  return n.toLocaleString('en-US', { useGrouping: false })
}

export default function TrunkDetail({ trunk, onChanged, onDeleteTrunk }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)

  const refresh = useCallback(() => {
    api.getSummary(trunk.id).then(setSummary).catch((e) => setError(e.message))
  }, [trunk.id])

  useEffect(() => {
    setSummary(null)
    setShowAssignForm(false)
    refresh()
  }, [trunk.id, refresh])

  if (error) return <div className="panel form">Failed to load: {error}</div>
  if (!summary) return <div className="panel form">Loading…</div>

  const assignments = [...summary.assignments].sort((a, b) => a.didStart - b.didStart)
  const segments = assignments.map((a, i) => ({
    count: a.channelsAssigned,
    color: tenantColor(i),
    label: `${a.tenantName} — ${a.channelsAssigned} ch`,
  }))

  async function handleAssign(payload) {
    await api.createAssignment(trunk.id, payload)
    refresh()
    onChanged?.()
  }

  async function handleUnassign(id) {
    if (!confirm('Remove this tenant assignment? Its channels and DIDs return to the free pool.')) return
    await api.deleteAssignment(id)
    refresh()
    onChanged?.()
  }

  async function handleDeleteTrunk() {
    if (!confirm(`Delete trunk "${trunk.name}" and all its tenant assignments? This can't be undone.`)) return
    await api.deleteTrunk(trunk.id)
    onDeleteTrunk?.()
  }

  return (
    <div className="detail">
      <div className="panel detail__head">
        <div className="detail__title">
          <span className={`env-tag env-tag--${trunk.environment}`}>{trunk.environment}</span>
          <h1>{trunk.name}</h1>
        </div>
        <button className="btn btn--danger" onClick={handleDeleteTrunk}>Delete trunk</button>
      </div>

      <div className="panel detail__stats">
        <div className="stat">
          <span className="stat__label">Pilot number</span>
          <span className="stat__value mono">{trunk.pilotNumber}</span>
        </div>
        <div className="stat">
          <span className="stat__label">DID range</span>
          <span className="stat__value mono">{fmtDID(trunk.didStart)} – {fmtDID(trunk.didEnd)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">CPS limit</span>
          <span className="stat__value mono">{trunk.cps}/s</span>
        </div>
        {trunk.notes && (
          <div className="stat stat--wide">
            <span className="stat__label">Notes</span>
            <span className="stat__value">{trunk.notes}</span>
          </div>
        )}
      </div>

      <div className="panel detail__capacity">
        <div className="capacity__row">
          <div className="capacity__label">
            <span>Channels</span>
            <span className="mono capacity__num">{summary.channelsUsed} / {trunk.totalChannels} used</span>
          </div>
          <JackBar total={trunk.totalChannels} segments={segments} />
        </div>

        <div className="capacity__row">
          <div className="capacity__label">
            <span>DID pool</span>
            <span className="mono capacity__num">{summary.didsAssigned} / {summary.totalDids} assigned</span>
          </div>
          <div className="didbar">
            {assignments.map((a, i) => {
              const left = ((a.didStart - trunk.didStart) / summary.totalDids) * 100
              const width = ((a.didEnd - a.didStart + 1) / summary.totalDids) * 100
              return (
                <div
                  key={a.id}
                  className="didbar__seg"
                  style={{ left: `${left}%`, width: `${width}%`, background: tenantColor(i) }}
                  title={`${a.tenantName}: ${fmtDID(a.didStart)}–${fmtDID(a.didEnd)}`}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="detail__tenants">
        <div className="detail__tenants-head">
          <h2>Tenants on this trunk</h2>
          <button className="btn btn--primary" onClick={() => setShowAssignForm((v) => !v)}>
            {showAssignForm ? 'Close' : '+ Assign tenant'}
          </button>
        </div>

        {showAssignForm && (
          <AssignmentForm
            onAssign={handleAssign}
            channelsFree={summary.channelsFree}
            didFloor={trunk.didStart}
            didCeil={trunk.didEnd}
          />
        )}

        {assignments.length === 0 ? (
          <div className="panel empty">No tenants assigned yet. Assign channels and a DID block to get started.</div>
        ) : (
          <div className="panel table">
            <div className="table__row table__row--head">
              <div>Tenant</div>
              <div>Channels</div>
              <div>DID range</div>
              <div>Notes</div>
              <div />
            </div>
            {assignments.map((a, i) => (
              <div className="table__row" key={a.id}>
                <div className="tenant-cell">
                  <span className="dot" style={{ background: tenantColor(i) }} />
                  {a.tenantName}
                </div>
                <div className="mono">{a.channelsAssigned}</div>
                <div className="mono">{fmtDID(a.didStart)}–{fmtDID(a.didEnd)}</div>
                <div className="dim">{a.notes || '—'}</div>
                <div>
                  <button className="btn btn--ghost btn--small" onClick={() => handleUnassign(a.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
