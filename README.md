# Trunkline — SIP Trunk Manager

A small full-stack app for tracking SIP trunks and how their channel/DID
capacity is carved up across tenants — e.g. 2 channels + 2 DIDs handed out
on a 20-channel lab trunk, and 20+ channels plus hundreds of DIDs on a
500-channel/1000-DID prod trunk.

- **Backend**: Go, standard library only (no external modules, no database —
  in-memory store persisted to `backend/data.json`). Easy to run anywhere a
  Go toolchain exists, nothing to `go get`.
- **Frontend**: React + Vite.

## What it does

- Create a SIP trunk with a pilot number, DID range, total channel count,
  and CPS limit.
- Assign a slice of a trunk's channels + a DID sub-range to a tenant.
- The backend rejects an assignment if:
  - it would exceed the trunk's total channels, or
  - its DID range falls outside the trunk's DID range, or
  - its DID range overlaps a DID range already assigned to another tenant.
- The UI shows live capacity: a "patch panel" style channel view (individual
  jacks for smaller trunks, a proportional bar for larger ones so a 500-channel
  trunk doesn't render 500 boxes) plus a DID allocation bar, and a table of
  every tenant assignment with one-click "Remove" to free capacity back up.
- Trunks are grouped by environment (lab / staging / prod) in the sidebar.

## Running it

### 1. Backend

```bash
cd backend
go run .
# listens on :8080, reads/writes backend/data.json for persistence
```

No `go mod tidy` / internet access needed — it only uses the Go standard
library.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# opens on :5173, proxies /api/* to :8080 automatically (see vite.config.js)
```

Then open http://localhost:5173.

To build a static production bundle: `npm run build` (outputs to
`frontend/dist`) — serve it with any static file server, or point Go at it
if you want a single deployable binary later.

## API

| Method | Path                          | Description                            |
|--------|-------------------------------|-----------------------------------------|
| GET    | /api/trunks                   | list trunks                             |
| POST   | /api/trunks                   | create a trunk                          |
| GET    | /api/trunks/{id}               | get one trunk                           |
| DELETE | /api/trunks/{id}               | delete a trunk (and its assignments)    |
| GET    | /api/trunks/{id}/summary       | trunk + assignments + capacity math     |
| GET    | /api/trunks/{id}/assignments   | list a trunk's tenant assignments       |
| POST   | /api/trunks/{id}/assignments   | assign channels/DIDs to a tenant        |
| DELETE | /api/assignments/{id}          | remove an assignment                    |

### Trunk payload

```json
{
  "name": "Airtel-Prod-01",
  "environment": "prod",
  "pilotNumber": "918041299900",
  "didStart": 918041200000,
  "didEnd": 918041200999,
  "totalChannels": 500,
  "cps": 50,
  "notes": "optional"
}
```

### Assignment payload (`POST /api/trunks/{id}/assignments`)

```json
{
  "tenantName": "Acme Corp",
  "channelsAssigned": 20,
  "didStart": 918041200000,
  "didEnd": 918041200029,
  "notes": "optional"
}
```

DIDs are stored as plain numbers so ranges can be validated with simple
integer math — enter DIDs as digits only (e.g. `918041200000`), no `+`,
spaces, or dashes.

## Extending this

- **Persistence**: swap `backend/store.go` for a real database (Postgres,
  etc.) — the handlers only touch the `Store` methods, so the storage layer
  is isolated.
- **Auth**: there isn't any yet — add middleware in `main.go` before putting
  this anywhere multi-user or internet-facing.
- **Per-tenant CPS**: CPS is captured per trunk only right now. If you need
  to cap CPS per tenant too, it's a natural extra field on `Assignment`.
- **Non-numeric DIDs**: if some of your DIDs aren't purely numeric, normalize
  them to a numeric key (e.g. strip formatting) before sending to the API, or
  extend the DID fields to strings with your own comparison/overlap logic.
