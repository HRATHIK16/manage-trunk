const BASE = '/api'

async function handle(res) {
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) {
    const msg = body?.error || `request failed (${res.status})`
    throw new Error(msg)
  }
  return body
}

export const api = {
  listTrunks: () => fetch(`${BASE}/trunks`).then(handle),
  createTrunk: (payload) =>
    fetch(`${BASE}/trunks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteTrunk: (id) =>
    fetch(`${BASE}/trunks/${id}`, { method: 'DELETE' }).then(handle),
  getSummary: (id) => fetch(`${BASE}/trunks/${id}/summary`).then(handle),
  createAssignment: (trunkId, payload) =>
    fetch(`${BASE}/trunks/${trunkId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteAssignment: (id) =>
    fetch(`${BASE}/assignments/${id}`, { method: 'DELETE' }).then(handle),
}
