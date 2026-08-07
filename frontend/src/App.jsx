import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import TrunkForm from './components/TrunkForm'
import TrunkDetail from './components/TrunkDetail'
import ActivityFeed from './components/ActivityFeed'
import './App.css'

function AuthedApp() {
  const [trunks, setTrunks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activityKey, setActivityKey] = useState(0)

  const bumpActivity = useCallback(() => setActivityKey((k) => k + 1), [])

  const load = useCallback(async () => {
    try {
      const list = await api.listTrunks()
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTrunks(list)
      setError('')
      return list
    } catch (e) {
      setError(e.message)
      return []
    }
  }, [])

  useEffect(() => {
    load().then((list) => {
      setLoading(false)
      if (list.length > 0) setSelectedId(list[0].id)
    })
  }, [load])

  async function handleCreateTrunk(payload) {
    const created = await api.createTrunk(payload)
    await load()
    setSelectedId(created.id)
    setShowForm(false)
    bumpActivity()
  }

  async function handleChanged() {
    load()
    bumpActivity()
  }

  async function handleTrunkDeleted() {
    const list = await load()
    setSelectedId(list[0]?.id ?? null)
    bumpActivity()
  }

  async function handleDataRestored() {
    const list = await load()
    setSelectedId(list[0]?.id ?? null)
    bumpActivity()
  }

  const selected = trunks.find((t) => t.id === selectedId) || null

  return (
    <div className="app">
      <Sidebar
        trunks={trunks}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setShowForm(false) }}
        onNew={() => setShowForm(true)}
        onDataChanged={handleDataRestored}
      />

      <main className="app__main">
        {loading && <div className="panel form">Loading trunks…</div>}

        {!loading && error && <div className="panel form">Couldn't reach the backend: {error}</div>}

        {!loading && !error && showForm && (
          <TrunkForm onSubmit={handleCreateTrunk} onCancel={() => setShowForm(false)} />
        )}

        {!loading && !error && !showForm && selected && (
          <TrunkDetail trunk={selected} onChanged={handleChanged} onDeleteTrunk={handleTrunkDeleted} />
        )}

        {!loading && !error && !showForm && !selected && (
          <div className="panel form empty-state">
            <h2>No SIP trunk selected</h2>
            <p>Add your first trunk — set its pilot number, DID range, channel count and CPS — then assign channels and DIDs to tenants as they onboard.</p>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ New trunk</button>
          </div>
        )}
      </main>

      <ActivityFeed refreshKey={activityKey} />
    </div>
  )
}

function Root() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <AuthedApp /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
