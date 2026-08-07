# Trunkline — SIP Trunk Manager

A small full-stack app for tracking SIP trunks and how their channel/DID
capacity is carved up across tenants — e.g. 2 channels + 2 DIDs handed out
on a 20-channel lab trunk, and 20+ channels plus hundreds of DIDs on a
500-channel/1000-DID prod trunk.

- **Backend**: Go, standard library only (no external modules, no database —
  in-memory store persisted to JSON files on disk). Easy to run anywhere a
  Go toolchain exists, nothing to `go get`.
- **Frontend**: React + Vite.

## What it does

- Create and **edit** a SIP trunk: pilot number, DID range, total channel
  count, CPS limit, environment (Prod or Lab — Prod is the default).
- Assign a slice of a trunk's channels + a DID sub-range to a tenant, and
  **edit** or remove that assignment later.
- The backend rejects a change if it would:
  - exceed the trunk's total channels,
  - place a DID range outside the trunk's DID range,
  - overlap a DID range already assigned to another tenant, or
  - shrink a trunk's channels/DID range below what's already assigned.
- Destructive actions (delete trunk, remove assignment, restore from backup)
  ask for confirmation in an in-app dialog — no browser popups.
- **Login required.** A small set of named users lives in
  `backend/config/users.json`; anyone on the list can sign in from the same
  page. Every change is attributed to whoever made it.
- **Activity feed** on the right of the screen shows a live log of who did
  what across every trunk — trunk created/edited/deleted, tenant
  assigned/edited/removed, restores, logins.
- **Backup & restore**: download a full snapshot (trunks, assignments, and
  activity history) as one JSON file any time, and restore it — on this
  deployment or a brand new one — to pick up exactly where you left off.
- The UI shows live capacity: a "patch panel" style channel view (individual
  jacks for smaller trunks, a proportional bar for larger ones so a 500-channel
  trunk doesn't render 500 boxes) plus a DID allocation bar, and a table of
  every tenant assignment.
- Trunks are grouped by environment (Prod / Lab) in the sidebar.

## Running it

### 1. Backend

```bash
cd backend
go run .
# listens on :8080
# reads/writes backend/data.json (trunks + assignments) and backend/audit.json (activity log)
```

No `go mod tidy` / internet access needed — it only uses the Go standard
library.

**Set up your users** before (or right after) first run — edit
`backend/config/users.json`:

```json
[
  { "username": "admin", "password": "changeme" },
  { "username": "priya", "password": "another-password" }
]
```

Add one entry per person who manages trunks. Restart the backend after
editing this file for changes to take effect. Passwords are stored in plain
text in this file on purpose — it's meant for a small, trusted internal
team; if you outgrow that, swap `backend/auth.go` for hashed passwords or a
real identity provider.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# opens on :5173, proxies /api/* to :8080 automatically (see vite.config.js)
```

Then open http://localhost:5173 and sign in with a user from
`config/users.json`.

To build a static production bundle: `npm run build` (outputs to
`frontend/dist`) — serve it with any static file server, or point Go at it
if you want a single deployable binary later.

## Backups

Click **Backup & restore** at the bottom of the sidebar:

- **Download backup** saves a dated `.json` file with every trunk,
  assignment, and the full activity history.
- **Restore** uploads a backup file and replaces everything currently in
  Trunkline with its contents (after an in-app confirmation, since it's
  destructive). This is the recommended way to move to a new VM: stand up
  the app fresh, log in, and restore your latest backup.

There's no automatic schedule built in — for regular backups, either make
it a habit, or hit `GET /api/backup` from a cron job / script on a schedule
(see the API table below; it needs an `Authorization: Bearer <token>`
header from a logged-in session).

## API

| Method | Path                          | Auth | Description                            |
|--------|-------------------------------|------|-----------------------------------------|
| POST   | /api/login                    | —    | `{username, password}` → `{token, username}` |
| POST   | /api/logout                   | ✓    | invalidate the current session          |
| GET    | /api/trunks                   | ✓    | list trunks                             |
| POST   | /api/trunks                   | ✓    | create a trunk                          |
| GET    | /api/trunks/{id}               | ✓    | get one trunk                           |
| PUT    | /api/trunks/{id}               | ✓    | edit a trunk                            |
| DELETE | /api/trunks/{id}               | ✓    | delete a trunk (and its assignments)    |
| GET    | /api/trunks/{id}/summary       | ✓    | trunk + assignments + capacity math     |
| GET    | /api/trunks/{id}/assignments   | ✓    | list a trunk's tenant assignments       |
| POST   | /api/trunks/{id}/assignments   | ✓    | assign channels/DIDs to a tenant        |
| PUT    | /api/assignments/{id}          | ✓    | edit a tenant assignment                |
| DELETE | /api/assignments/{id}          | ✓    | remove an assignment                    |
| GET    | /api/audit?limit=50            | ✓    | recent activity feed entries            |
| GET    | /api/backup                    | ✓    | download a full JSON snapshot           |
| POST   | /api/restore                   | ✓    | replace all data with an uploaded snapshot |

All `✓` routes need `Authorization: Bearer <token>` from `/api/login`.

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

`environment` must be `"prod"` or `"lab"` (empty defaults to `"prod"`).

### Assignment payload (`POST`/`PUT` on assignments)

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
- **Stronger auth**: hash passwords, add rate limiting on `/api/login`, or
  swap `backend/auth.go` for a real identity provider if the team grows.
- **Per-tenant CPS**: CPS is captured per trunk only right now. If you need
  to cap CPS per tenant too, it's a natural extra field on `Assignment`.
- **Non-numeric DIDs**: if some of your DIDs aren't purely numeric, normalize
  them to a numeric key (e.g. strip formatting) before sending to the API, or
  extend the DID fields to strings with your own comparison/overlap logic.
