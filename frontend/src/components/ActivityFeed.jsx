import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import './ActivityFeed.css'

function timeAgo(iso) {
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 45) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

const ACTION_DOT = {
  'trunk.created': 'green',
  'trunk.updated': 'amber',
  'trunk.deleted': 'red',
  'assignment.created': 'green',
  'assignment.updated': 'amber',
  'assignment.deleted': 'red',
  'backup.restored': 'blue',
  'auth.login': 'dim',
}

export default function ActivityFeed({ refreshKey }) {
  const [entries, setEntries] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.getAudit(60).then(setEntries).catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  useEffect(() => {
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  return (
    <aside className="activity">
      <div className="activity__head">Activity</div>
      <div className="activity__list">
        {error && <div className="activity__empty">Couldn't load activity.</div>}
        {!error && entries.length === 0 && (
          <div className="activity__empty">Nothing yet — changes to trunks and tenants will show up here.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="activity__item">
            <span className={`activity__dot activity__dot--${ACTION_DOT[e.action] || 'dim'}`} />
            <div className="activity__body">
              <div className="activity__msg">
                <strong>{e.user}</strong> {e.message}
              </div>
              <div className="activity__time">{timeAgo(e.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
