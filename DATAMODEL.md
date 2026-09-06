# DATAMODEL.md — data contract & backend specification

Source of truth for the data that flows between the frontend and the backend. Future agents
implementing the backend (Prisma ORM + Postgres) or changing frontend entity shapes must keep
this file in sync (see the rule in `AGENTS.md`).

> **Status: PARTIAL.** Auth, Tasks, and Calendar are implemented end-to-end: Hono API on
> Cloudflare Workers → Postgres via Prisma, with transactional email via Resend. The remaining
> feature stores (Diary, Agents, Timer prefs) are still client-side (`zustand` →
> `localStorage`) and not yet synced. See §1 and §4 for what is live vs. planned.

---

## 1. Current reality (stores, sync, tokens)

- Feature data lives in zustand stores persisted to `localStorage` (zustand `persist`).
- The Electron main window and the dashboard widget sync via the browser `storage` event
  (`enableCrossWindowSync()` in `apps/web/src/main.tsx`) — same-origin `localStorage`.
- Auth/session is server-backed. Timestamps in stores are **epoch milliseconds**; the API
  carries ISO 8601 strings and the sync layer converts.
- Date-only fields use `YYYY-MM-DD` (`apps/web/src/global/lib/dates.ts`); times are `HH:mm`.

| Store (key)                         | Frontend entity        | Server model   | Persist server-side?        |
| ----------------------------------- | ---------------------- | -------------- | --------------------------- |
| `ontrack-user`                      | `AppUser`, session     | `User`         | **Yes — auth (live)**       |
| `ontrack-notes`                     | `NoteTask`, board      | `Task`         | **Yes (live)**              |
| `ontrack-calendar`                  | `Appointment`, `CalendarEventKind` | `Appointment` | **Yes (live)**            |
| `ontrack-diary`                     | `DiaryEntry`           | `DiaryEntry`   | Planned (schema exists)     |
| `ontrack-agents`                    | `Agent`                | `Agent`        | Planned (schema exists)     |
| `ontrack-timer`                     | timer settings         | `TimerSettings`| Planned (schema exists; prefs only) |
| `ontrack-timer`                     | reminders              | `Reminder`     | Planned                    |
| `ontrack-timer`                     | live session state     | —              | **No** (ephemeral)          |
| `ontrack-dashboard`                 | widget config          | —              | **No** (device-local)       |
| `ontrack-theme`                     | theme id               | —              | **No** (device-local)       |

### Session / auth tokens (implemented)

- Backend issues a 15-min **access token** (JWT, HS256, `jose`) and a 30-day **refresh token**
  (opaque). The app keeps the access token **in memory** only and the refresh token in
  `localStorage` under `ontrack-refresh-token`.
- `apps/web/src/global/lib/session.ts` owns token storage; `api.ts` transparently refreshes on
  a 401 (single-flight) and retries once. On refresh failure the session is cleared and the
  app redirects to sign-in (`ontrack:session-expired` event → `useUserStore`).
- Signing **up does not return tokens**: the account must be email-verified first, then sign in.
- Signing **out** revokes the single refresh token server-side; a signed-out refresh fails.
- The refresh token is **not rotated** (deliberate: avoids multi-window Electron races).

---

## 2. Domain entities

> Field names in JSON are `camelCase`, matching the frontend stores exactly.

### User (auth)

Front source: `apps/web/src/global/stores/useUserStore.ts` — `AppUser` (defined in
`apps/web/src/global/repositories/auth.repository.ts`).

| Field            | Type                 | Notes                                          |
| ---------------- | -------------------- | ---------------------------------------------- |
| `id`             | string (cuid)        |                                                |
| `email`          | string               | unique, normalized lowercase                    |
| `name`           | string               |                                                |
| `emailVerified`  | boolean              | must be `true` to sign in                       |
| `createdAt`      | datetime             | ISO on the wire                                |

Server-side only (never returned): `passwordHash` (bcrypt, 12 rounds),
`refreshTokenDigest` (SHA-256 of the refresh token) + `refreshTokenExpiresAt`.
Verification/reset links are single-use tokens stored hashed... see schema §3.

### Task (Notes / kanban)

Front source: `apps/web/src/global/stores/useNotesStore.ts` — `NoteTask`, `TaskStatus`, `TaskPriority`.

| Field      | Type               | Notes                                                        |
| ---------- | ------------------ | ------------------------------------------------------------ |
| `id`       | string (cuid)      | may be client-generated and sent in `POST` body              |
| `title`    | string             | required                                                     |
| `text`     | string             | defaults `""`                                                |
| `priority` | `low \| medium \| high` | defaults `medium`                                        |
| `status`   | `todo \| doing \| done` | derived from board column; stored as a column             |
| `position` | int                | stable ordering within a status column (drag & drop order)   |
| `dueDate`  | `string \| null`   | `YYYY-MM-DD` or `null`                                       |
| `createdAt`| datetime           | client sends epoch ms → API stores ISO                       |
| `doneAt`   | `datetime \| null` | set when status becomes `done` via `/move`; cleared leaving `done` |

Board = `{ todo: NoteTask[], doing: NoteTask[], done: NoteTask[] }`; storage flattens into
`status` + `position`. Ordering invariant: **dense, unique positions per `(userId, status)`**.

### Appointment / calendar entity (implemented)

Front source: `apps/web/src/global/stores/useCalendarStore.ts` — `Appointment`,
`CalendarEventKind`, `LoadStatus`.

| Field       | Type                        | Notes                                          |
| ----------- | --------------------------- | ----------------------------------------------- |
| `id`        | string (cuid)               | may be client-generated and sent in `POST` body |
| `kind`      | `appointment \| birthday \| task` | `task` = static calendar reminder (no done state) |
| `title`     | string                      | required                                        |
| `date`      | string                      | `YYYY-MM-DD`                                    |
| `startTime` | string                      | `HH:mm`; `""` for all-day birthdays             |
| `endTime`   | `string \| null`            | `HH:mm` or `null`                               |
| `color`     | string (hex)                | defaults `#8b5cf6`; calendar tasks use a fixed `#f59e0b` |
| `notes`     | string                      | defaults `""`                                   |

**Entity separation (enforced 2026-09):** Notes tasks (`ontrack-notes` → `Task`) and Calendar
entries (`ontrack-calendar` → `Appointment`) are **two distinct entities that never mix.** The
Calendar page's "Task" action and `TaskModal` add an `Appointment` of `kind: 'task'` — they no
longer touch `useNotesStore`. The Today page and Today widget list **only** calendar entries
(no notes board reads). Notes tasks appear only in the Notes tab + Notes widget. `.persisted
`ontrack-calendar` syncs optimistically on first `ensureLoaded()`: server wins, un-synced local
entries are uploaded; the demo seed (Morning meds / Therapy call / Gym) uploads for a brand-new
account.

### DiaryEntry, Agent, TimerSettings + Reminder

Contracts unchanged from the planned spec (server models exist in the schema; the API and the
frontend sync layer are not implemented yet). See the entity tables below the Appointment table
in the original doc — those fields are still accurate.

---

## 3. Prisma schema (Postgres — applied)

`apps/backend/prisma/schema.prisma` (Prisma 7, `prisma-client` generator with
`runtime = "workerd"`, adapter `@prisma/adapter-pg`). Notes on Prisma 7 + Workers:

- `datasource` has **no `url`** — the connection string comes from `prisma.config.ts`
- The client is generated **into the repo** (`output = "../src/generated/prisma"`) and imported as
  `../generated/prisma/client`; do not regenerate to `node_modules/@prisma/client`.
- Cloudflare Workers needs `compatibility_flags: ["nodejs_compat"]` (set in `wrangler.jsonc`).

**Connection strategy (important):** `apps/backend/src/db.ts` creates a **fresh
`PrismaClient` + pg pool per request** instead of caching a singleton. Cached pooled sockets
die between workerd isolate activations and the pool doesn't notice (the next query hangs with
"The Workers runtime canceled this request because ... hung"). Parameters: `max: 1`,
`connectionTimeoutMillis: 3000`, `idleTimeoutMillis: 500` (idle sockets self-close, so nothing
leaks). Cost is one TCP+handshake per request (~10-30 ms local); revisit with Hyperdrive for
production.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  runtime  = "workerd"
}

datasource db {
  provider = "postgresql"
}

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  name                  String
  passwordHash          String
  emailVerified         Boolean   @default(false)
  refreshTokenDigest    String?   @unique
  refreshTokenExpiresAt DateTime?

  createdAt updatedAt /* standard */

  tasks             Task[]
  appointments      Appointment[]
  diaryEntries      DiaryEntry[]
  agents            Agent[]
  timerSettings     TimerSettings?
  reminders         Reminder[]
  verificationToken EmailVerificationToken?
  resetToken        PasswordResetToken?
}

model EmailVerificationToken {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String   @unique
  token     String   @unique // opaque, one per user (upserted)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String   @unique
  token     String   @unique // opaque, one per user (upserted)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

enum TaskStatus   { todo doing done }
enum TaskPriority { low medium high }
enum CalendarEventKind { appointment birthday task }
enum Mood         { great good okay low rough }

model Task {
  id        String       @id @default(cuid())
  userId    String
  title     String
  text      String       @default("")
  priority  TaskPriority @default(medium)
  status    TaskStatus   @default(todo)
  position  Int          @default(0)
  dueDate   String? // "YYYY-MM-DD"
  createdAt DateTime     @default(now())
  doneAt    DateTime?

  @@unique([userId, status, position])
  @@index([userId, status])
}

model Appointment {
  id        String             @id @default(cuid())
  userId    String
  kind      CalendarEventKind  @default(appointment)
  title     String
  date      String // "YYYY-MM-DD"
  startTime String // "HH:mm"
  endTime   String?
  color     String
  notes     String             @default("")
  @@index([userId, date])
}

model DiaryEntry {
  id        String   @id @default(cuid())
  userId    String
  date      String // "YYYY-MM-DD"
  title     String
  content   String
  mood      Mood     @default(okay)
  tags      String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId, date])
}

model Agent {
  id           String   @id @default(cuid())
  userId       String
  name         String
  role         String
  icon         String
  color        String
  description  String
  preferences  String[] @default([])
  enabled      Boolean  @default(true)
}

model TimerSettings {
  id              String   @id @default(cuid())
  userId          String   @unique
  presets         Int[]    @default([10, 15, 25, 45])
  soundOn         Boolean  @default(true)
  notificationsOn Boolean  @default(false)
}

model Reminder {
  id              String   @id @default(cuid())
  userId          String
  kind            String   @default("focus") // 'focus' | 'break'
  message         String
  level           Int      @default(1) // 1 | 2 | 3
  createdAt       DateTime @default(now())
  lastEscalatedAt DateTime @default(now())
  @@index([userId])
}
```

Email/PIN verification tokens are stored **plaintext** (`token`); the refresh token is stored
as a **SHA-256 digest** (it is the long-lived credential, so it never sits in the DB readable).

---

## 4. REST API contract (Hono)

- Base path prefix: `/api`. Auth routes under `/api/auth`, tasks under `/api/tasks`.
- **Auth:** JWT `Authorization: Bearer <accessToken>` for `/api/tasks`. CORS is open (desktop app).
- **Envelope:** success → `{ "data": T }` (mutations return the entity; deletes/void → `204`).
  Errors → `{ "error": { "code", "message" } }` with 4xx/5xx status.
- Validation: zod in the backend. Timestamps cross as ISO 8601; the frontend converts.
- Dev: Vite proxies `/api` → `http://127.0.0.1:8787` (`wrangler dev` default).

### Auth (implemented)

| Method | Path                           | Body / Query                       | Returns                      |
| ------ | ------------------------------ | ---------------------------------- | ---------------------------- |
| POST   | `/api/auth/signup`             | `{ email, name, password }`        | `201 { data: { user } }` + verification email (no tokens) |
| GET    | `/api/auth/verify-email`       | `?token=`                          | `204`                        |
| POST   | `/api/auth/verify-email/resend`| `{ email }`                        | `{ data: { message } }` (always benign) |
| POST   | `/api/auth/signin`             | `{ email, password }`              | `{ data: { user, accessToken, expiresIn, refreshToken } }`; 403 `EMAIL_UNVERIFIED` if unverified |
| POST   | `/api/auth/refresh`            | `{ refreshToken }`                 | same shape; new refresh token; invalidates old |
| POST   | `/api/auth/signout`            | — (auth)                           | `204`; revokes refresh token |
| GET    | `/api/auth/me`                 | — (auth)                           | `{ data: user }`             |
| PATCH  | `/api/auth/me`                 | `{ name?, avatarUrl? }` (auth)     | `{ data: user }` (avatar not in UI yet) |
| PATCH  | `/api/auth/password`           | `{ currentPassword, newPassword }`(auth) | `204`; revokes session |
| POST   | `/api/auth/forgot-password`    | `{ email }`                        | `{ data: { message } }` (always benign) |
| POST   | `/api/auth/reset-password`     | `{ token, newPassword }`           | `204`                        |

Error codes used: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `EMAIL_UNVERIFIED`, `UNAUTHORIZED`,
`INVALID_VERIFICATION`, `INVALID_RESET_TOKEN`, `INVALID_PASSWORD`, `VALIDATION`, `INTERNAL`.

### Tasks (implemented)

| Method | Path                  | Body / Query                  | Returns |
| ------ | --------------------- | ----------------------------- | ------- |
| GET    | `/api/tasks`          | `?status=todo\|doing\|done`  | `{ data: Task[] }`, ordered by status then position |
| POST   | `/api/tasks`          | `{ id?, title, text?, priority?, dueDate?, createdAt? }`; `status` forced `todo`, `position` appended | `201 { data: Task }` |
| PATCH  | `/api/tasks/:id`      | `{ title?, text?, priority?, dueDate? }` (scalars only) | `{ data: Task }` |
| PATCH  | `/api/tasks/:id/move` | `{ to, toIndex? }`            | `{ data: Task }` |
| DELETE | `/api/tasks/:id`      | —                             | `204` |

`/move` semantics mirror store `moveTask`: status `done` stamps `doneAt`, leaving `done` clears
it; source column is re-densified and the target column is rearranged in a transaction
(positions written with a 1,000,000-offset trick to dodge the unique constraint). The task's
status is flipped on the row *before* either column is re-densified so the target reindex can't
collide with the source column's positions. On the client, the notes store mutates the board
locally during drag (preview) and calls `/move` exactly **once on drop** (`commitRowMove`) to
avoid a burst of concurrent `move` requests; `toggleDone` writes once per click.

### Appointments (implemented)

| Method | Path                      | Body / Query                  | Returns |
| ------ | ------------------------- | ----------------------------- | ------- |
| GET    | `/api/appointments`       | — (auth)                      | `{ data: Appointment[] }`, ordered by date then startTime |
| POST   | `/api/appointments`       | `{ id?, kind, title, date, startTime?, endTime?, color?, notes? }` | `201 { data: Appointment }` (client `id` honored) |
| PATCH  | `/api/appointments/:id`   | any subset of `kind/title/date/startTime/endTime/color/notes` (at least one) | `{ data: Appointment }` |
| DELETE | `/api/appointments/:id`   | —                             | `204` |

Validation: `kind` ∈ `appointment|birthday|task`, `title` 1..200, `date` `YYYY-MM-DD`,
`startTime`/`endTime` `HH:mm` or empty (birthdays), `color` 1..50. All scoped to the authed
user; `404 NOT_FOUND` for another user's id.

### Diary, Agents, Timer (planned — endpoints unchanged from the original spec)

Not implemented yet; models exist. Future implementers: follow the envelope, auth middleware,
and per-user scoping used by the tasks endpoints.

---

## 5. Frontend integration notes (implemented for auth + tasks)

- **API base:** `/api` (relative) via the Vite dev proxy. Electron packaged builds must set an
  absolute backend origin (e.g. `VITE_API_BASE`) — still outstanding.
- **Lazy loading:** stores expose a non-persisted `loadStatus: 'idle' | 'loading' | 'loaded' |
  'error'` and `ensureLoaded()`. Pages call `ensureLoaded()` on mount (Today, Notes, Calendar for
  now); nothing is fetched at app start.
- **Optimistic writes:** the notes store mutates locally, pushes in the background, and on
  failure reloads the board from the server and toasts (`useToastStore`). The calendar store
  follows the same pattern (add/update/remove are optimistic; on failure it re-fetches and
  toasts). The dashboard widget's Today wedge calls `ensureLoaded()` itself on mount since the
  widget window does not render the pages that would trigger it.
- `ontrack-dashboard` and `ontrack-theme` stay client-only (device-local preferences).
- Keep the reminder escalation loop in `useTimerStore` intact; reminders stay local-first.

## 6. Backend deployment notes (applied for auth + tasks)

- Prisma 7 + Cloudflare Workers: `nodejs_compat` flag, `@prisma/adapter-pg` driver adapter,
  `runtime = "workerd"` on the generator, client generated in-repo. `DATABASE_URL` is a
  `wrangler dev` `.dev.vars` secret (and a Worker secret at deploy).
- Migrations: applied via `prisma migrate deploy` (local Docker Postgres `ontrack-pg`).
  `prisma migrate dev` is non-interactive-unfriendly; hand-written migrations + `migrate deploy`
  when needed.
- Env bindings in `wrangler.jsonc`: `WEB_URL` (var), plus secrets `DATABASE_URL`, `JWT_SECRET`,
  `RESEND_API_KEY` in `.dev.vars` (local) / Worker secrets (prod).
- The position-densify invariant must be moved/adjusted in a **transaction** (see tasks service).

## 7. Open decisions

1. ~~Auth strategy~~ **Resolved:** email + password, custom JWT, email verification + password
   reset via Resend. The `RESEND_API_KEY` was pasted in a session once — **revoke/rotate it**.
2. Sync strategy for the remaining stores (Diary/Agents/Timer prefs) — same
   optimistic lazy-load pattern as notes/calendar. Calendar resolved with the appointments API.
3. Whether dashboard widgets/theme should ever sync across devices (currently device-local).
4. Reminder `lastEscalatedAt`/level semantics offline (local-first).
5. Production Electron: absolute API origin + token rehydration for `file://` builds.
6. Per-request pg connections work locally; evaluate **Hyperdrive** (or a warm pool) before real
   production traffic to cut handshake latency.