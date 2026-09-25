# DATAMODEL.md — data contract & backend specification

Source of truth for the data that flows between the frontend and the backend. Future agents
implementing the backend (Prisma ORM + Postgres) or changing frontend entity shapes must keep
this file in sync (see the rule in `AGENTS.md`).

> **Status: PARTIAL.** Auth, Tasks, Calendar, Diary, and the **Agent platform** are implemented
> end-to-end: Hono API on Cloudflare Workers → Postgres via Prisma, transactional email via
> Resend, LLM execution via BYOK model keys (OpenRouter default). Agent data is server-synced
> (agents, model keys, inbox messages, run history). Timer prefs and reminders are still
> client-side (`zustand` → `localStorage`) and not yet synced. Gmail OAuth connection is wired
> (`/api/auth/gmail/*`) but requires live Google credentials to exercise fully.

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
| `ontrack-diary`                     | `DiaryEntry`           | `DiaryEntry`   | **Yes (live)**              |
| `ontrack-agents`                    | `Agent` + templates    | `Agent`,`AgentTemplate` | **Yes (live)**     |
| `ontrack-model-keys`                | `ModelKey`             | `ModelKey`     | **Yes (live)**              |
| `ontrack-agent-messages`            | `AgentMessage` (inbox) | `AgentMessage` | **Yes (live)**              |
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
| `priority` | `low \| medium \| high \| daily` | defaults `medium`; `daily` tasks auto-reset to `todo` on their next day |
| `status`   | `todo \| doing \| done` | derived from board column; stored as a column             |
| `position` | int                | stable ordering within a status column (drag & drop order)   |
| `dueDate`  | `string \| null`   | `YYYY-MM-DD` or `null`                                       |
| `createdAt`| datetime           | client sends epoch ms → API stores ISO                       |
| `doneAt`   | `datetime \| null` | set when status becomes `done` via `/move`; cleared leaving `done` |

Board = `{ todo: NoteTask[], doing: NoteTask[], done: NoteTask[] }`; storage flattens into
`status` + `position`. Ordering invariant: **dense, unique positions per `(userId, status)`**.

**Daily-priority reset (client-driven):** when a `daily` task's `dueDate` is before today, the
notes store moves it back to `todo` (from `doing`/`done`), clears `doneAt`, and bumps `dueDate`
to today on the next board load — then syncs via `/move` + `PATCH`. The server stores whatever
state it's given; it does not roll daily tasks itself.

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

### DiaryEntry

Front source: `apps/web/src/global/stores/useDiaryStore.ts` — `DiaryEntry`, `Mood`, `LoadStatus`.

| Field       | Type               | Notes                                                        |
| ----------- | ------------------ | ------------------------------------------------------------ |
| `id`        | string (cuid)      | may be client-generated and sent in `POST` body              |
| `date`      | string             | `YYYY-MM-DD`                                                 |
| `title`     | string             | optional in the UI; stored `""`                              |
| `content`   | string             | optional in the UI; stored `""`                              |
| `mood`      | `great\|good\|okay\|low\|rough` | defaults `okay`                                  |
| `tags`      | string[]           | defaults `[]`                                                |
| `hidden`    | boolean            | defaults `false`. Hidden entries return `content: ""` in every list response until unlocked |
| `createdAt` | datetime           | client sends epoch ms on create → API stores ISO (preserves seed order) |
| `updatedAt` | datetime           | maintained by the API                                        |

**Hidden-entry contract:** list/create/update/delete responses **strip `content` to `""`** for
`hidden: true` rows. `POST /api/diary/unlock` verifies the account password (bcrypt vs
`passwordHash`) and then **persists `hidden = false`** in the DB — revealing is one-way and
permanent; the entry becomes fully visible everywhere, and the user can re-hide it later via the
editor toggle (a plain `PATCH {hidden:true}`, no password needed, since the entry is already
visible). `PATCH`/`DELETE` on a still-hidden entry (direct API call) still require `password`
(`HIDDEN_ENTRY` 403 when missing, `INVALID_PASSWORD` 403 when wrong) — the frontend never hits
this path because it routes hidden-entry mutations through the reveal modal first.

**Sync semantics:** optimistic, mirroring notes/calendar. First `ensureLoaded()` on a fresh
server seeds the legacy `ontrack-diary` localStorage cache up (one-time, only when the server has
zero entries). The list is **month-paginated** (5-row pages, `date DESC, createdAt DESC`); the
month dropdown covers the last 24 months up to the newest entry month. The store keeps the union
of loaded months in `entries` (sorted); `entries[0]` is therefore the globally newest entry and
feeds the Today page + dashboard widget (hidden latest → "Hidden entry" placeholder).

### Agent platform (implemented — v2 scope)

Front sources:
- `apps/web/src/global/stores/useAgentsStore.ts` — `Agent`, `AgentTool`, `AgentTemplate`
- `apps/web/src/global/stores/useModelKeysStore.ts` — `ModelKey`
- `apps/web/src/global/stores/useAgentMessagesStore.ts` — `AgentMessage` (inbox)

**Execution model (v2):** button-triggered only, no cron/streaming. `POST /api/agents/:id/run`
compiles one full `RunResult` and returns it in a single response. Budget guards: max 50
runs/day/user (429), in-flight concurrency lock per agent (409), per-run `maxTokens` clamped to
8000 server-side. All external content is wrapped in `<untrusted_data>` tags before hitting the
LLM; output JSON is validated by Zod. `draftOnly=true` is the default on every agent. The runner
composes the system prompt from the agent's Markdown `description` (the `prompt` column is no
longer used).

**Default agents (v2.1):** 3 pre-built agents are seeded per user — adherent **Email Summarizer**
(`email_read`/`classify`/`calendar_write`/`note_write`/`task_move`), **Job Finder**
(`job_search`/`web_fetch`/`note_write`, 10–25 verified listings), and **Daily News Provider**
(`news_read`/`web_fetch`/`summarize`, sources `['hn']`). Each ships with an editable Markdown
system prompt in `description` (sections to customize). Seeded on signup (`auth.service.signup`)
and lazily backfilled in `agentsService.listAgents` the first time a user is in a zero-agent state
(idempotent by exact name — deleting one does not bring it back; deleting all does, on the next
fetch). Definitions live in `seed.service.ts` (`DEFAULT_AGENTS`, `seedDefaultAgents`).

| Entity        | Source fields (JSON, camelCase)                                                                                              | Notes |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| `Agent`       | `id, name, role, icon, color, description, preferences[], enabled, templateId?, triggerType, sources[], output, prompt?, draftOnly, modelKeyId?, maxTokens, lastRunAt?, runCount, createdAt, updatedAt, tools?[]` | `triggerType`/`schedule`/`timezone` reserved for v3; `output` ∈ `message\|note\|email`; **`description` is a Markdown doc and is what the runner sends to the LLM as system instructions** (replaces `prompt`, retained for legacy only); creating from a template copies `defaultRole` and seeds `defaultPrompt` into the editable `description` + `AgentTool` rows |
| `AgentTemplate` | `id, slug, name, description, category, icon, requiresOAuth?, defaultRole, defaultPrompt, defaultSources[], defaultTools[], defaultOutput, configSchema?, sortOrder` | 3 seeded: `email-summarizer`, `job-tracker`, `news-provider` (upserted on first `/api/templates` hit) |
| `AgentTool`    | `id, agentId, toolName, enabled, config?`                                                                                   | per-agent tool row; `toolName` ∈ registry (14 tools) |
| `ModelKey`     | `id, provider, label, defaultModel, baseUrl?, createdAt`                                                                    | **`apiKeyEnc` never leaves the server** (AES-256-GCM, `MODEL_KEY_ENCRYPTION_KEY`); POST live-validates against **that key's own provider** (free endpoint) and stores the resolved `baseUrl` |
| `AgentMessage` | `id, agentId, title, body (markdown), read, createdAt`                                                                      | inbox; delivery target of every run that outputs `message`/`email` |
| `AgentRun`     | via `GET /api/agents/:id/runs` → `{ runId, status, message?, sideEffects?, tokensUsed, durationMs, error?, startedAt }`   | audit log; snapshots/`toolCalls` stored on the row but not returned by the list |
| `IntegrationAccount` | `id, provider ("gmail"), email?, scope[], tokenEnc, tokenExpiry?`                                                       | tokens AES-256-GCM (`INTEGRATION_ENCRYPTION_KEY`), `gmail.readonly` scope |

**Security model:** `email_read` requires a connected Gmail `IntegrationAccount`
(`requiresOAuth: "gmail"`); OAuth-gated tools show "Connect Gmail" in the editor until
connected. Model keys: GET returns label/provider/model ONLY. Gmail disconnect revokes tokens
and deletes the row (`DELETE /api/auth/gmail/disconnect`).

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
enum TaskPriority { low medium high daily }
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
  hidden    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId, date])
}

model Agent {
  id           String          @id @default(cuid())
  userId       String
  templateId   String?
  name         String
  role         String
  icon         String
  color        String
  description  String
  preferences  String[]        @default([])
  enabled      Boolean         @default(true)
  triggerType  AgentTriggerType @default(manual) // reserved (v3+)
  schedule     String?                            // reserved (v3+)
  timezone     String           @default("UTC")   // reserved (v3+)
  sources      String[]         @default([])
  output       AgentOutputType  @default(message)
  prompt       String?
  draftOnly    Boolean          @default(true)
  modelKeyId   String?
  maxTokens    Int              @default(2000)
  lastRunAt    DateTime?
  nextRunAt    DateTime?                          // reserved (v3+)
  runCount     Int              @default(0)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  runs         AgentRun[]
  messages     AgentMessage[]
  tools        AgentTool[]
  modelKey     ModelKey?         @relation(fields: [modelKeyId], references: [id])
  template     AgentTemplate?    @relation(fields: [templateId], references: [id])
}

enum AgentTriggerType { manual schedule }
enum AgentOutputType  { message note email }

model AgentTemplate {
  id             String           @id @default(cuid())
  slug           String           @unique
  name           String
  description    String
  category       String
  icon           String
  requiresOAuth  String? // "gmail" | null
  defaultRole    String
  defaultPrompt  String
  defaultSources String[]         @default([])
  defaultTools   String[]         @default([])
  defaultOutput  AgentOutputType  @default(message)
  configSchema   Json?
  sortOrder      Int              @default(0)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  agents         Agent[]
}

model ModelKey {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // normalized to: openrouter | deepseek | groq | openai | anthropic
  label        String
  apiKeyEnc    String   // AES-256-GCM
  baseUrl      String?  // resolved on create; the agent run uses this, never a hardcoded default
  defaultModel String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  agents       Agent[]
  @@unique([userId, provider, label])
}

model AgentTool {
  id       String  @id @default(cuid())
  agentId  String
  toolName String
  enabled  Boolean @default(false)
  config   Json?
  @@unique([agentId, toolName])
  @@index([agentId])
}

model AgentRun {
  id         String   @id @default(cuid())
  userId     String
  agentId    String
  status     String   @default("running") // running | success | failed | skipped
  inputSnap  String?
  outputSnap String?
  toolCalls  String?
  tokensUsed Int      @default(0)
  error      String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  @@index([userId, agentId, startedAt])
}

model AgentMessage {
  id        String   @id @default(cuid())
  userId    String
  agentId   String
  title     String
  body      String   // markdown
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, read])
}

model IntegrationAccount {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // "gmail"
  email       String?
  scope       String[] @default([])
  tokenEnc    String   // AES-256-GCM
  tokenExpiry DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([userId, provider, email])
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
- Dev: Vite proxies `/api` → `http://127.0.0.1:7891` (`wrangler dev --port 7891`).

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
`INVALID_VERIFICATION`, `INVALID_RESET_TOKEN`, `INVALID_PASSWORD`, `HIDDEN_ENTRY`, `VALIDATION`,
`INTERNAL`.

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

### Diary (implemented)

| Method | Path                      | Body / Query                  | Returns |
| ------ | ------------------------- | ----------------------------- | ------- |
| GET    | `/api/diary`              | `?month=YYYY-MM&offset&limit` (auth) | `{ data: { entries, hasMore } }`; hidden → `content:""`; `month` omitted = all months |
| POST   | `/api/diary`              | `{ id?, title?, content?, mood?, tags?, date, hidden?, createdAt? }` | `201 { data: DiaryEntry }` (client `id`/`createdAt` honored) |
| POST   | `/api/diary/unlock`       | `{ id, password }`            | verifies password, **persists `hidden=false`**, returns `{ data: DiaryEntry }` full (content included); `403 INVALID_PASSWORD` |
| PATCH  | `/api/diary/:id`          | any subset of `title/content/mood/tags/date/hidden` + `password?` (at least one field) | `{ data: DiaryEntry }` — hidden rows require `password` |
| DELETE | `/api/diary/:id`          | `{ password? }`               | `204` — hidden rows require `password` |

Validation: `date` `YYYY-MM-DD`, `month` `YYYY-MM`, `mood` ∈ `great|good|okay|low|rough`,
`tags` string[] ≤ 20 × ≤ 50 chars, `content` ≤ 50_000, `title` ≤ 200, `offset` int ≥ 0,
`limit` int 1..50 (default 5). List ordered `date DESC, createdAt DESC` (existing
`@@index([userId, date])` serves the month range). All routes auth + scoped to the owner,
`404 NOT_FOUND` for another user's id.

### Agents (implemented)

| Method | Path                    | Body / Query                 | Returns                                   |
| ------ | ----------------------- | ---------------------------- | ----------------------------------------- |
| GET    | `/api/agents`           | —                            | `{ data: Agent[] }` (tools included)      |
| POST   | `/api/agents`           | `{ name, role, icon, color, description, preferences?, templateId?, prompt?, sources?, output?, draftOnly?, modelKeyId?, maxTokens? }` | `201 { data: Agent }` (template defaults + `AgentTool` rows applied when `templateId` set) |
| GET    | `/api/agents/:id`       | —                            | `{ data: Agent }`                         |
| PATCH  | `/api/agents/:id`       | any subset of the above      | `{ data: Agent }` (at least one field)    |
| DELETE | `/api/agents/:id`       | —                            | `204` (cascades runs/messages/tools)      |
| POST   | `/api/agents/:id/run`   | —                            | `{ data: RunResult }`; `400 DISABLED`, `404`, `409 CONFLICT` (in-flight), `429 RATE_LIMIT` |
| GET    | `/api/agents/:id/runs`  | `?limit&offset`              | `{ data: { runs: RunListItem[], hasMore } }` |
| POST   | `/api/agents/actions`   | `{ items: ActionItem[] }`    | `{ data: { created: { kind, id }[] } }` — creates `Appointment` (`task` → `kind:'task'`, `event` → `kind:'appointment'`) and `DiaryEntry` (`note`, tagged `agent-output`); triggered only after the user approves proposed items in the UI |

```ts
type ActionItem = {
  kind: 'task' | 'event' | 'note'
  title: string
  date?: string // "YYYY-MM-DD", required for task/event
  startTime?: string // "HH:mm"
  endTime?: string | null
  note?: string
}
```

```ts
type RunResult = {
  runId: string
  status: 'success' | 'failed'
  message?: { id: string; title: string; body: string }
  pendingActions?: ActionItem[] // parsed from [TASK]/[EVENT]/[NOTE] lines in the LLM output; user approves before /api/agents/actions creates them
  sideEffects?: Array<{ kind: 'note'|'calendar'|'email'; status: 'created'|'drafted'|'blocked'; title?: string; id?: string }>
  tokensUsed: number
  durationMs: number
  error?: string
}
```

### Templates / tools / messages (implemented)

| Method | Path                              | Body / Query                   | Returns                                   |
| ------ | --------------------------------- | ------------------------------ | ----------------------------------------- |
| GET    | `/api/templates`                  | —                              | `{ data: AgentTemplate[] }` (seeds upsert on first hit) |
| GET    | `/api/tools/available`            | —                              | `{ data: ToolDefinition[] }` (14 tools, grouped by category) |
| GET    | `/api/tools/agents/:id/tools`     | —                              | `{ data: AgentTool[] }`                   |
| PATCH  | `/api/tools/agents/:id/tools/:toolName` | `{ enabled?, config? }`   | `{ data: AgentTool }` (upsert)            |
| GET    | `/api/agents/messages`            | `?offset&limit&unread=`        | `{ data: { messages, hasMore } }`         |
| PATCH  | `/api/agents/messages/:id`        | `{ read: true }`               | `{ data: AgentMessage }`                  |
| DELETE | `/api/agents/messages/:id`        | —                              | `204`                                     |
| GET    | `/api/runs/:runId`                | —                              | `{ data: RunListItem }`                   |

### ModelKeys (BYOK, implemented)

| Method | Path                | Body / Query                    | Returns                                       |
| ------ | ------------------- | ------------------------------- | --------------------------------------------- |
| GET    | `/api/model-keys`   | —                               | `{ data: ModelKey[] }` — redacted (no key)    |
| POST   | `/api/model-keys`   | `{ provider, label, apiKey, defaultModel, baseUrl? }` | `201 { data: ModelKey }` — **live-validated** against the provider before storing |
| DELETE | `/api/model-keys/:id` | —                            | `204`; clears `Agent.modelKeyId` references    |

### Gmail OAuth (implemented, requires live credentials)

| Method   | Path                            | Auth   | Flow |
| -------- | ------------------------------- | ------ | ---- |
| GET      | `/api/auth/gmail/connect`       | bearer | `{ data: { authUrl } }` Google OAuth URL (scope `gmail.readonly openid email profile`); sets the `gmail_oauth_nonce` HttpOnly `SameSite=Lax` cookie and returns a `state` JWT |
| GET      | `/api/auth/gmail/callback`      | public | verifies `state` + nonce cookie, exchanges `code`, resolves the account email, upserts `IntegrationAccount`, then redirects `{WEB_URL}/#/agents?gmail=connected` (or `?gmail=denied\|csrf_failed\|invalid_request\|failed`) |
| GET      | `/api/auth/gmail/status`        | bearer | `{ data: { isConnected, email } }` |
| DELETE   | `/api/auth/gmail`               | bearer | revokes at Google (best effort), then deletes the row → `{ data: { isConnected: false, wasConnected } }` |

**Token handling.** `IntegrationAccount.tokenEnc` holds ONLY the AES-GCM encrypted
*refresh* token (`INTEGRATION_ENCRYPTION_KEY`). Access tokens live in a module-level
`Map` in `integrations.service.ts`, scoped to the Worker isolate and never persisted;
only `tokenExpiry` is written back on refresh. A Cloudflare Worker has no durable
memory, so a cold isolate simply refreshes on first use.

**CSRF.** The app is Bearer-only (no session cookie), so the callback cannot identify
the user from a header. `state` is a short-lived (600 s) JWT carrying `userId` +
`nonce`, signed with a **domain-separated HMAC key** derived from `JWT_SECRET`
(`gmail-oauth-state.ts`). Domain separation matters: `verifyAccessToken` accepts any
HS256 token with a `sub`, so without it a `state` value would double as a valid
access token. The mirrored nonce cookie is what proves the callback returned to the
same browser that started the flow.

**Agent runs.** `agent.runner.ts` calls `getGmailAccessToken` rather than decrypting
`tokenEnc` directly. If Gmail is enabled but unconnected (or the grant is dead), the
run **short-circuits before the LLM call**, writes an explanation through
`formatOutput`, and returns `tokensUsed: 0` — it does not silently produce a summary
with no mail in it.

---

## 5. Frontend integration notes (implemented for auth + tasks)

- **API base:** `/api` (relative) via the Vite dev proxy. Electron packaged builds must set an
  absolute backend origin (e.g. `VITE_API_BASE`) — still outstanding.
- **Lazy loading:** stores expose a non-persisted `loadStatus: 'idle' | 'loading' | 'loaded' |
  'error'` and `ensureLoaded()`. Pages call `ensureLoaded()` on mount (Today, Notes, Calendar,
  Diary for now); nothing is fetched at app start. Diary additionally loads per-month pages and
  paginates (`ensureMonth` / `loadMore`).
- **Optimistic writes:** the notes store mutates locally, pushes in the background, and on
  failure reloads the board from the server and toasts (`useToastStore`). The calendar store
  follows the same pattern (add/update/remove are optimistic; on failure it re-fetches and
  toasts). The diary store follows the same pattern; `INVALID_PASSWORD` and `AUTH_REQUIRED`
  errors skip the toast (the reveal modal surfaces the former inline, the auth redirect handles
  the latter). The dashboard widget's Today wedge calls `ensureLoaded()` itself on mount since
  the widget window does not render the pages that would trigger it.
- `ontrack-dashboard` and `ontrack-theme` stay client-only (device-local preferences).
- Keep the reminder escalation loop in `useTimerStore` intact; reminders stay local-first.

## 6. Backend deployment notes (applied for auth + tasks)

- Prisma 7 + Cloudflare Workers: `nodejs_compat` flag, `@prisma/adapter-pg` driver adapter,
  `runtime = "workerd"` on the generator, client generated in-repo. `DATABASE_URL` is a
  `wrangler dev` `.dev.vars` secret (and a Worker secret at deploy).
- Migrations: applied via `prisma migrate deploy` (local Docker Postgres `ontrack-pg`).
  `prisma migrate dev` is non-interactive-unfriendly; hand-written migrations + `migrate deploy`
  when needed.
- Env bindings in `wrangler.jsonc`: `WEB_URL` (var), plus secrets in `.dev.vars`:
  `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`,
  `MODEL_KEY_ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. `OPENROUTER_API_KEY` is only the
  fallback for agents with **no** `ModelKey`; BYOK keys carry their own `baseUrl`.
- Provider routing lives in `apps/backend/src/lib/llm-providers.ts` (single source of
  truth, shared by key validation and the agent run). Never hardcode a vendor base
  URL in a service — that silently sends a key to the wrong API.
- BYOK live validation uses token-free endpoints only (`/models`, DeepSeek
  `/user/balance`), so adding a key costs nothing.
- The position-densify invariant must be moved/adjusted in a **transaction** (see tasks service).

## 7. Open decisions

1. ~~Auth strategy~~ **Resolved:** email + password, custom JWT, email verification + password
   reset via Resend. The `RESEND_API_KEY` was pasted in a session once — **revoke/rotate it**.
2. Sync strategy for the remaining stores (Timer prefs) — same optimistic lazy-load pattern as
   notes/calendar. Calendar resolved with the appointments API; Diary resolved with the diary
   API (§4); Agents resolved with the agents/templates/model-keys/messages APIs (§4, v2-date).
3. Whether dashboard widgets/theme should ever sync across devices (currently device-local).
4. Reminder `lastEscalatedAt`/level semantics offline (local-first).
5. Production Electron: absolute API origin + token rehydration for `file://` builds.
6. Per-request pg connections work locally; evaluate **Hyperdrive** (or a warm pool) before real
   production traffic to cut handshake latency.