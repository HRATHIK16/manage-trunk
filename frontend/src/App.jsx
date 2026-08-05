import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import TrunkForm from './components/TrunkForm'
import TrunkDetail from './components/TrunkDetail'
import './App.css'

export default function App() {
  const [trunks, setTrunks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const list = await api.listTrunks()
      list.sort((a, b) => a.name.localeCompare(b.name))
      setTrunks(list)
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
  }

  async function handleChanged() {
    load()
  }

  async function handleTrunkDeleted() {
    const list = await load()
    setSelectedId(list[0]?.id ?? null)
  }

  const selected = trunks.find((t) => t.id === selectedId) || null

  return (
    <div className="app">
      <Sidebar
        trunks={trunks}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setShowForm(false) }}
        onNew={() => setShowForm(true)}
      />

      <main className="app__main">
        {loading && <div className="panel form">Loading trunks…</div>}

        {!loading && error && <div className="panel form">Couldn't reach the backend: {error}</div>}

        {!loading && !error && showForm && (
          <TrunkForm onCreate={handleCreateTrunk} onCancel={() => setShowForm(false)} />
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
    </div>
  )
}
