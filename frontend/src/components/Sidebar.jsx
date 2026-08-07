import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import BackupPanel from './BackupPanel'
import './Sidebar.css'

const ORDER = ['prod', 'lab']

export default function Sidebar({ trunks, selectedId, onSelect, onNew, onDataChanged }) {
  const { username, logout } = useAuth()
  const [showBackup, setShowBackup] = useState(false)

  const groups = {}
  for (const t of trunks) {
    const key = t.environment || 'other'
    groups[key] = groups[key] || []
    groups[key].push(t)
  }
  const envKeys = [...ORDER.filter((k) => groups[k]), ...Object.keys(groups).filter((k) => !ORDER.includes(k))]

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark">◆</span>
        <span>Trunk Manager</span>
      </div>

      <button className="btn btn--primary sidebar__new" onClick={onNew}>+ New trunk</button>

      <div className="sidebar__list">
        {trunks.length === 0 && <div className="sidebar__empty">No trunks yet.</div>}
        {envKeys.map((env) => (
          <div key={env} className="sidebar__group">
            <div className="sidebar__group-label">{env}</div>
            {groups[env].map((t) => (
              <button
                key={t.id}
                className={'sidebar__item' + (t.id === selectedId ? ' sidebar__item--active' : '')}
                onClick={() => onSelect(t.id)}
              >
                <span className={`sidebar__dot sidebar__dot--${env}`} />
                <span className="sidebar__item-text">
                  <span className="sidebar__item-name">{t.name}</span>
                  <span className="sidebar__item-sub mono">{t.totalChannels} channels</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <button className="sidebar__footer-btn" onClick={() => setShowBackup(true)}>
          ⇩ Backup &amp; restore
        </button>
        <div className="sidebar__user">
          <span className="sidebar__user-name mono">{username}</span>
          <button className="sidebar__footer-btn sidebar__footer-btn--muted" onClick={logout}>Log out</button>
        </div>
      </div>

      {showBackup && (
        <BackupPanel onClose={() => setShowBackup(false)} onRestored={onDataChanged} />
      )}
    </aside>
  )
}
