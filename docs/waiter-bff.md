# Waiter BFF Contract (v1)

## Base
- All endpoints are exposed by Next.js BFF in this app.
- Responses are JSON and sent with `Cache-Control: no-store`.

## Auth
### `POST /api/auth/login`
Body:
```json
{ "login": "marco", "password": "waiter123" }
```
Response:
```json
{
  "session": { "role": "waiter", "waiterId": "w-marco" },
  "waiter": { "id": "w-marco", "name": "Марко Р." }
}
```
or
```json
{
  "session": { "role": "manager", "managerId": "m-giotto" },
  "manager": { "id": "m-giotto", "name": "Giotto Manager" }
}
```
- Sets HttpOnly cookie:
  - waiter: `giotto_waiter_session`
  - manager: `giotto_manager_session`
- JWT format (demo signature), TTL 12h.

### `POST /api/auth/logout`
- Clears both session cookies (`giotto_waiter_session`, `giotto_manager_session`).

### `GET /api/auth/session`
Response:
```json
{ "session": { "role": "waiter", "waiterId": "w-marco", "expiresAt": 1770000000000 } }
```
or
```json
{ "session": { "role": "manager", "managerId": "m-giotto", "expiresAt": 1770000000000 } }
```
or
```json
{ "session": null }
```

## Waiter role endpoints
### `GET /api/waiter/me/tables`
- Requires waiter session.
- Returns waiter profile and assigned tables with optional active request.

### `GET /api/waiter/tables/:tableId`
- Requires waiter session.
- Returns detailed table payload: active requests, bill lines, total, session note, done cooldown, review prompt (if active).

### `POST /api/waiter/tables/:tableId/ack`
Body:
```json
{ "requestId": "rq-w-3" }
```
- Marks request acknowledged/resolved.
- Emits realtime: `waiter:acknowledged`, `table:status_changed`.

### `POST /api/waiter/tables/:tableId/done`
- Sets 30s done cooldown.
- Creates review prompt (TTL 60s).
- Emits realtime: `waiter:done`.

### `POST /api/waiter/tables/:tableId/orders`
Body:
```json
{
  "items": [
    { "dishId": "panna", "title": "Panna cotta", "qty": 2, "price": 64000 }
  ]
}
```
- Adds waiter bill lines.
- Emits realtime: `order:added_by_waiter`, `table:status_changed`.

### `PATCH /api/waiter/tables/:tableId/note`
Body:
```json
{ "note": "аллергия на орехи" }
```
- Stores note scoped to table session (`tableId + guestStartedAt`).

## Guest service endpoints
### `GET /api/table/:tableId/request?type=waiter|bill`
- Returns cooldown state for call button.

### `POST /api/table/:tableId/request`
Body:
```json
{ "type": "waiter" }
```
Response:
```json
{
  "cooldown": { "type": "waiter", "availableAt": 1770000000000, "remainingSec": 120 },
  "accepted": true
}
```
- Enforces 120s cooldown server-side.
- Emits realtime: `waiter:called` or `bill:requested`, and `table:status_changed`.

### `POST /api/table/:tableId/review`
Body:
```json
{ "rating": 5, "comment": "Очень быстро" }
```
- Accepts feedback only while review prompt is active.
- Emits realtime: `review:submitted`.

## Realtime
### `GET /api/realtime/stream`
- SSE stream with heartbeat.
- Event types:
  - `waiter:called`
  - `bill:requested`
  - `waiter:acknowledged`
  - `waiter:done`
  - `order:added_by_waiter`
  - `review:submitted`
  - `table:status_changed`

Event shape:
```json
{
  "id": "evt-uuid",
  "type": "waiter:done",
  "tableId": 5,
  "ts": 1770000000000,
  "actor": "w-marco",
  "payload": { "expiresAt": 1770000060000 }
}
```

## Backend mode and fallback
- BFF tries remote beta server first using `GIOTTO_BETA_SERVER_URL`.
- On remote unavailability, BFF falls back to local demo adapter.
- Force local demo only: `GIOTTO_FORCE_DEMO_BACKEND=1`.
