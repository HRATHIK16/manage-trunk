// import.meta.env.BASE_URL is Vite's configured `base` (e.g. "/" by
// default, or "/trunks/" when built with `--base=/trunks/` for a subpath
// deployment). Deriving the API path from it means api.js automatically
// calls the right place either way, with no hardcoded assumption about
// where the app is hosted.
const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/{2,}/g, '/')
const TOKEN_KEY = 'trunkline_token'

let token = localStorage.getItem(TOKEN_KEY) || null

export function setToken(t) {
  token = t
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return token
}

function authHeaders(extra = {}) {
  const h = { ...extra }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function handle(res) {
  if (res.status === 401) {
    setToken(null)
    window.dispatchEvent(new CustomEvent('trunkline:unauthorized'))
  }
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) {
    const msg = body?.error || `request failed (${res.status})`
    throw new Error(msg)
  }
  return body
}

export const api = {
  login: (username, password) =>
    fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(handle),

  logout: () =>
    fetch(`${BASE}/logout`, { method: 'POST', headers: authHeaders() })
      .then(handle)
      .catch(() => {}),

  listTrunks: () => fetch(`${BASE}/trunks`, { headers: authHeaders() }).then(handle),

  createTrunk: (payload) =>
    fetch(`${BASE}/trunks`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(handle),

  updateTrunk: (id, payload) =>
    fetch(`${BASE}/trunks/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(handle),

  deleteTrunk: (id) =>
    fetch(`${BASE}/trunks/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle),

  getSummary: (id) => fetch(`${BASE}/trunks/${id}/summary`, { headers: authHeaders() }).then(handle),

  createAssignment: (trunkId, payload) =>
    fetch(`${BASE}/trunks/${trunkId}/assignments`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(handle),

  updateAssignment: (id, payload) =>
    fetch(`${BASE}/assignments/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(handle),

  deleteAssignment: (id) =>
    fetch(`${BASE}/assignments/${id}`, { method: 'DELETE', headers: authHeaders() }).then(handle),

  getAudit: (limit = 60) =>
    fetch(`${BASE}/audit?limit=${limit}`, { headers: authHeaders() }).then(handle),

  downloadBackup: async () => {
    const res = await fetch(`${BASE}/backup`, { headers: authHeaders() })
    if (!res.ok) throw new Error('backup failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trunkline-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },

  restore: (jsonText) =>
    fetch(`${BASE}/restore`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: jsonText,
    }).then(handle),
}
