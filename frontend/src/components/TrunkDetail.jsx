import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import JackBar, { tenantColor } from './JackBar'
import AssignmentForm from './AssignmentForm'
import TrunkForm from './TrunkForm'
import ConfirmDialog from './ConfirmDialog'
import './forms.css'
import './TrunkDetail.css'

function fmtDID(n) {
  return n.toLocaleString('en-US', { useGrouping: false })
}

export default function TrunkDetail({ trunk, onChanged, onDeleteTrunk }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [assignForm, setAssignForm] = useState(null) // null | { mode: 'create', prefillRange? } | { mode: 'edit', assignment }
  const [editingTrunk, setEditingTrunk] = useState(false)
  const [confirmState, setConfirmState] = useState(null)

  const refresh = useCallback(() => {
    api.getSummary(trunk.id).then(setSummary).catch((e) => setError(e.message))
  }, [trunk.id])

  useEffect(() => {
    setSummary(null)
    setAssignForm(null)
    setEditingTrunk(false)
    refresh()
  }, [trunk.id, refresh])

  if (error) return <div className="panel form">Failed to load: {error}</div>
  if (!summary) return <div className="panel form">Loading…</div>

  const didRanges = trunk.didRanges || []
  const freeDidRanges = summary.freeDidRanges || []
  const assignments = [...summary.assignments].sort((a, b) => a.didStart - b.didStart)
  const segments = assignments.map((a, i) => ({
    count: a.channelsAssigned,
    color: tenantColor(i),
    label: `${a.tenantName} — ${a.channelsAssigned} ch`,
  }))
  const colorByAssignmentId = Object.fromEntries(assignments.map((a, i) => [a.id, tenantColor(i)]))

  async function handleTrunkEditSubmit(payload) {
    await api.updateTrunk(trunk.id, payload)
    setEditingTrunk(false)
    onChanged?.()
    refresh()
  }

  async function handleAssignSubmit(payload) {
    if (assignForm.mode === 'edit') {
      await api.updateAssignment(assignForm.assignment.id, payload)
    } else {
      await api.createAssignment(trunk.id, payload)
    }
    setAssignForm(null)
    refresh()
    onChanged?.()
  }

  function handleUnassign(a) {
    setConfirmState({
      title: 'Remove assignment',
      message: `Remove ${a.tenantName}'s assignment? Its ${a.channelsAssigned} channel${a.channelsAssigned === 1 ? '' : 's'} and DID block return to the free pool.`,
      danger: true,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await api.deleteAssignment(a.id)
        setConfirmState(null)
        refresh()
        onChanged?.()
      },
    })
  }

  function handleDeleteTrunk() {
    setConfirmState({
      title: 'Delete trunk',
      message: `Delete trunk "${trunk.name}" and all its tenant assignments? This can't be undone.`,
      danger: true,
      confirmLabel: 'Delete trunk',
      onConfirm: async () => {
        await api.deleteTrunk(trunk.id)
        setConfirmState(null)
        onDeleteTrunk?.()
      },
    })
  }

  if (editingTrunk) {
    return (
      <TrunkForm
        initial={trunk}
        onSubmit={handleTrunkEditSubmit}
        onCancel={() => setEditingTrunk(false)}
      />
    )
  }

  // When editing an assignment, its own channels/DIDs count as "free" again
  // for the form's headroom — and its own DID block should show up as an
  // available option too, since the tenant can shrink or move within it.
  const editingAssignment = assignForm?.mode === 'edit' ? assignForm.assignment : null
  const channelsFreeForForm = editingAssignment
    ? summary.channelsFree + editingAssignment.channelsAssigned
    : summary.channelsFree
  const freeRangesForForm = editingAssignment
    ? [...freeDidRanges, { start: editingAssignment.didStart, end: editingAssignment.didEnd }].sort((a, b) => a.start - b.start)
    : freeDidRanges

  function openAssignForm(prefillRange) {
    setAssignForm({ mode: 'create', prefillRange })
  }

  return (
    <div className="detail">
      <div className="panel detail__head">
        <div className="detail__title">
          <span className={`env-tag env-tag--${trunk.environment}`}>{trunk.environment}</span>
          <h1>{trunk.name}</h1>
        </div>
        <div className="detail__head-actions">
          <button className="btn" onClick={() => setEditingTrunk(true)}>Edit trunk</button>
          <button className="btn btn--danger" onClick={handleDeleteTrunk}>Delete trunk</button>
        </div>
      </div>

      <div className="panel detail__stats">
        <div className="stat">
          <span className="stat__label">Pilot number</span>
          <span className="stat__value mono">{trunk.pilotNumber}</span>
        </div>
        <div className="stat">
          <span className="stat__label">CPS</span>
          <span className="stat__value mono">{trunk.cps}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Total channels</span>
          <span className="stat__value mono">{trunk.totalChannels}</span>
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
            <span>DID pool{didRanges.length > 1 ? ` — ${didRanges.length} ranges` : ''}</span>
            <span className="mono capacity__num">{summary.didsAssigned} / {summary.totalDids} assigned</span>
          </div>

          <div className="didranges">
            {didRanges.map((range, ri) => {
              const rangeSize = range.end - range.start + 1
              const rangeAssignments = assignments.filter((a) => a.didStart >= range.start && a.didEnd <= range.end)
              const rangeUsed = rangeAssignments.reduce((sum, a) => sum + (a.didEnd - a.didStart + 1), 0)
              return (
                <div className="didrange" key={ri}>
                  <div className="didrange__label">
                    <span className="mono">{fmtDID(range.start)}–{fmtDID(range.end)}</span>
                    <span className="dim mono">{rangeUsed} / {rangeSize}</span>
                  </div>
                  <div className="didbar">
                    {rangeAssignments.map((a) => {
                      const left = ((a.didStart - range.start) / rangeSize) * 100
                      const width = ((a.didEnd - a.didStart + 1) / rangeSize) * 100
                      return (
                        <div
                          key={a.id}
                          className="didbar__seg"
                          style={{ left: `${left}%`, width: `${width}%`, background: colorByAssignmentId[a.id] }}
                          title={`${a.tenantName}: ${fmtDID(a.didStart)}–${fmtDID(a.didEnd)}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {freeDidRanges.length > 0 && (
            <div className="free-ranges free-ranges--inline">
              <span className="free-ranges__label">Available now</span>
              <div className="free-ranges__chips">
                {freeDidRanges.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    className="free-ranges__chip mono"
                    onClick={() => openAssignForm(r)}
                    title="Assign a tenant to this block"
                  >
                    {fmtDID(r.start)}–{fmtDID(r.end)}
                    <span className="free-ranges__chip-count">{(r.end - r.start + 1).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="detail__tenants">
        <div className="detail__tenants-head">
          <h2>Tenants on this trunk</h2>
          <button
            className="btn btn--primary"
            onClick={() => setAssignForm(assignForm ? null : { mode: 'create' })}
          >
            {assignForm ? 'Close' : '+ Assign tenant'}
          </button>
        </div>

        {assignForm && (
          <AssignmentForm
            initial={editingAssignment}
            prefillRange={assignForm.prefillRange}
            onSubmit={handleAssignSubmit}
            onCancel={() => setAssignForm(null)}
            channelsFree={channelsFreeForForm}
            freeRanges={freeRangesForForm}
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
            {assignments.map((a) => (
              <div className="table__row" key={a.id}>
                <div className="tenant-cell">
                  <span className="dot" style={{ background: colorByAssignmentId[a.id] }} />
                  {a.tenantName}
                </div>
                <div className="mono">{a.channelsAssigned}</div>
                <div className="mono">{fmtDID(a.didStart)}–{fmtDID(a.didEnd)}</div>
                <div className="dim">{a.notes || '—'}</div>
                <div className="table__row-actions">
                  <button className="btn btn--ghost btn--small" onClick={() => setAssignForm({ mode: 'edit', assignment: a })}>Edit</button>
                  <button className="btn btn--ghost btn--small" onClick={() => handleUnassign(a)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
