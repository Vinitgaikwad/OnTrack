# SUGGESTION.md — Agent Platform: Architecture & Design

> This is a **design suggestion**, not a spec that's been approved. Read it, disagree with it,
> and treat every section as a proposal. Update `DATAMODEL.md` (and this doc) when the shape is
> locked — it remains the contract between stores and backend.

## 1. Where we are today (the gap)

- Agents are **cards, not agents**: `useAgentsStore` (`apps/web/src/global/stores/useAgentsStore.ts`)
  persists `{ name, role, icon, color, description, preferences[], enabled }` to `localStorage`.
- Prisma already has an `Agent` model but **no routes, no service, no scheduling, no runtime**.
- Nothing ever runs. There is no trigger, no input, no output, no execution log.

## 2. Architecture — bottom-up

Every agent is just four layers stacked:

```
┌─────────────────────────────────────────────┐
│           4. FRONTEND                       │
│  Agent editor (toggles) · Inbox · Logs      │
├─────────────────────────────────────────────┤
│           3. TOOLS & PERMISSIONS            │
│  Web fetch · Email · Calendar · Notes · ... │
│  Each tool = capability + toggle + guard    │
├─────────────────────────────────────────────┤
│           2. APIs                           │
│  CRUD · Run · Schedule · Log               │
├─────────────────────────────────────────────┤
│           1. DATA                           │
│  Agent · AgentRun · AgentMessage ·          │
│  IntegrationAccount · ModelKey              │
└─────────────────────────────────────────────┘
```

Non-technical users only touch Layer 4. Layers 1-3 are the machine underneath. The key
insight: **every tool is a toggle**. No agent can access a capability unless the user
explicitly enabled it. No config files, no YAML, no "guard rules" — just switches.

---

## 3. Layer 1 — Data Model

Extend the existing `Agent` model (backwards-compatible, additive). Add three new models:
`ModelKey` (BYOK), `AgentTool` (permission grants), and `AgentMessage` (inbox).

```prisma
enum AgentTriggerType { manual schedule }
enum AgentOutputType  { message note email }

model Agent {
  id          String          @id @default(cuid())
  userId      String
  name        String
  role        String
  icon        String
  color       String
  description String
  preferences String[]        @default([])
  enabled     Boolean         @default(true)

  // Trigger
  triggerType AgentTriggerType @default(manual)
  schedule    String?          // "daily 08:00" | "weekly Mon,Wed 09:00" | cron
  timezone    String           @default("UTC")

  // Sources (what data the agent can read)
  sources     String[]         @default([])   // ["notes","calendar","diary","email"]

  // Output
  output      AgentOutputType  @default(message)
  prompt      String?          // user's custom instruction override
  draftOnly   Boolean          @default(true) // "draft, don't send" safety default

  // Execution
  modelKeyId  String?          // FK → ModelKey (which LLM to use)
  maxTokens   Int              @default(2000) // per-run token cap
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  runCount    Int              @default(0)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  runs         AgentRun[]
  messages     AgentMessage[]
  tools        AgentTool[]
  modelKey     ModelKey?       @relation(fields: [modelKeyId], references: [id])
}

// BYOK — user provides their own API key
model ModelKey {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // "deepseek" | "openai" | "anthropic" | "groq"
  label       String   // "My DeepSeek key" — user-facing name
  apiKeyEnc   String   // encrypted API key (AES-256-GCM, same pattern as IntegrationAccount)
  baseUrl     String?  // optional override for self-hosted / proxied endpoints
  defaultModel String  // "deepseek-chat" | "gpt-4o-mini" | "claude-3-haiku" | etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([userId, provider, label])
}

// Permission grant — one row per tool per agent
model AgentTool {
  id       String  @id @default(cuid())
  agentId  String
  toolName String  // "web_search" | "web_fetch" | "gmail_read" | "gmail_send" | etc.
  enabled  Boolean @default(false)
  config   Json?   // tool-specific settings (e.g. { maxResults: 5 } for search)
  @@unique([agentId, toolName])
  @@index([agentId])
}

model AgentRun {
  id         String   @id @default(cuid())
  userId     String
  agentId    String
  status     String   @default("running") // running | success | failed | skipped
  inputSnap  String?  // JSON, truncated (~2 KB) — what the agent saw
  outputSnap String?  // JSON, truncated — what it produced
  toolCalls  String?  // JSON array — which tools were invoked and results
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
  body      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, read])
}

model IntegrationAccount {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // "gmail" first
  email       String?
  scope       String[] @default([])
  tokenEnc    String   // encrypted access + refresh tokens
  tokenExpiry DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([userId, provider, email])
}
```

Notes on the shapes:
- `AgentTool` replaces the vague `sources String[]` with explicit per-tool grants. Each row
  is a toggle: `enabled: true` = user turned it on. The `config` JSON holds tool-specific
  settings (max results, allowed domains, etc.) so we don't need extra columns.
- `ModelKey` is the BYOK surface: user pastes their API key once, picks a default model, and
  agents reference it. Keys are encrypted at rest; the worker decrypts only at call time.
- `AgentRun.toolCalls` logs every tool invocation for debugging ("why did it search for X?").
- `AgentRun.tokensUsed` is the cost guardrail surface — hard stop when cumulative daily
  usage exceeds the user's budget.
- Migration = additive (new enums + tables), so `migrate deploy` is non-destructive.

---

## 4. Layer 2 — APIs

Follow the existing layered pattern (controller → service → repository). Mirror the
optimistic sync pattern from tasks/calendar/diary.

### Agent CRUD

| Method | Path                    | Body / Query                        | Returns |
| ------ | ----------------------- | ----------------------------------- | ------- |
| GET    | `/api/agents`           | — (auth)                            | `{ data: Agent[] }` |
| POST   | `/api/agents`           | `{ name, role, icon, color, description, preferences?, sources?, output?, prompt?, modelKeyId?, ... }` | `201 { data: Agent }` |
| PATCH  | `/api/agents/:id`       | any subset of fields                | `{ data: Agent }` |
| DELETE | `/api/agents/:id`       | —                                   | `204` |

### Agent Tools (permission management)

| Method | Path                              | Body / Query              | Returns |
| ------ | --------------------------------- | ------------------------- | ------- |
| GET    | `/api/agents/:id/tools`          | —                         | `{ data: AgentTool[] }` (all tools, with `enabled` flag) |
| PATCH  | `/api/agents/:id/tools/:toolName`| `{ enabled?, config? }`   | `{ data: AgentTool }` — toggle a tool on/off or update its config |
| GET    | `/api/tools/available`           | —                         | `{ data: ToolDefinition[] }` — list of all tools the user can grant (name, description, requiresOAuth, category) |

### Agent Execution

| Method | Path                    | Body / Query                | Returns |
| ------ | ----------------------- | --------------------------- | ------- |
| POST   | `/api/agents/:id/run`   | — (auth)                    | `202 { data: { runId } }` — kicks off async execution |
| GET    | `/api/agents/:id/runs`  | `?offset&limit`             | `{ data: AgentRun[] }` — execution history |
| GET    | `/api/runs/:runId`      | —                           | `{ data: AgentRun }` — full run detail with tool calls |

### Agent Messages (inbox)

| Method | Path                    | Body / Query                | Returns |
| ------ | ----------------------- | --------------------------- | ------- |
| GET    | `/api/agents/messages`  | `?offset&limit&unread=`     | `{ data: { messages, hasMore } }` |
| PATCH  | `/api/agents/messages/:id` | `{ read: true }`         | `{ data: AgentMessage }` |
| DELETE | `/api/agents/messages/:id` | —                         | `204` |

### Model Keys (BYOK)

| Method | Path                    | Body / Query                        | Returns |
| ------ | ----------------------- | ----------------------------------- | ------- |
| GET    | `/api/model-keys`       | — (auth)                            | `{ data: ModelKey[] }` (API keys redacted, show label + provider + default model) |
| POST   | `/api/model-keys`       | `{ provider, label, apiKey, baseUrl?, defaultModel }` | `201 { data: ModelKey }` (key encrypted before storage) |
| DELETE | `/api/model-keys/:id`   | —                                   | `204` (cascade: agents using it lose their modelKeyId) |

### Scheduling

Cloudflare Cron Triggers can't run at arbitrary per-user times. The standard approach:
- One coarse cron in `wrangler.jsonc` (`*/5 * * * *`), handler = "find agents whose
  `nextRunAt` has passed and who aren't already queued" → kick them off.
- `Agent.lastRunAt / nextRunAt` columns make the fan-out idempotent.
- Granularity: "daily at 08:00" means "the first sweep after 08:00".

---

## 5. Layer 3 — Tools & Permissions

This is the core of the seamless experience. Every capability an agent can use is a **tool**.
Tools are grouped by category, each with a clear description of what it does and what it
needs. Users grant tools via toggles — no code, no config, no YAML.

### Tool Registry

A static registry of all available tools. The backend serves this to the frontend via
`GET /api/tools/available`. Each tool definition includes:

```typescript
type ToolDefinition = {
  name: string           // unique id: "web_search", "gmail_read", etc.
  label: string          // human name: "Internet Search"
  description: string    // what it does in plain English
  category: 'data' | 'communication' | 'productivity' | 'ai'
  icon: string           // lucide icon name
  requiresOAuth: boolean // true = needs IntegrationAccount before toggling on
  configSchema?: object  // optional JSON Schema for tool-specific settings
}
```

### The Tool Catalogue — cheapest option per category

Each tool maps to the **cheapest viable implementation** for a Cloudflare Worker + BYOK
stack. No paid SaaS where a free/self-hosted alternative exists.

#### DATA TOOLS (reading information)

| Tool | What it does | Cheapest implementation | Cost |
|------|-------------|------------------------|------|
| `web_search` | Search the internet | **DeepSeek's built-in web search** (if available on their API) or **SearXNG self-hosted** (free, no API key) or **Tavily free tier** (1,000 req/mo) | Free |
| `web_fetch` | Read a URL's content | **`fetch()` + `@mozilla/readability`** (HTML→text) on the Worker itself. No external service. | Free (Worker CPU time) |
| `notes_read` | Read user's notes board | Direct Prisma query — `db.task.findMany({ where: { userId } })`. Already implemented in `task.service.ts`. | Free |
| `calendar_read` | Read user's appointments | Direct Prisma query — `db.appointment.findMany({ where: { userId } })`. Already in `appointment.service.ts`. | Free |
| `diary_read` | Read user's diary entries | Direct Prisma query — `db.diaryEntry.findMany({ where: { userId, hidden: false } })`. Hidden entries **excluded by default** (hard rule, not a toggle). Already in `diary.service.ts`. | Free |
| `email_read` | Read emails | **Gmail API** via `IntegrationAccount` (OAuth already designed in §5 of original doc). Read-only scope `gmail.readonly`. | Free (Gmail API quota) |
| `job_search` | Search job boards | **`web_fetch` on saved URLs** — user provides a list of search URLs (LinkedIn, Indeed, etc.), agent fetches + parses them. No job board API needed. | Free |

#### COMMUNICATION TOOLS (sending / outputting)

| Tool | What it does | Cheapest implementation | Cost |
|------|-------------|------------------------|------|
| `email_send` | Send email to user | **Resend** — already integrated (`email.service.ts`). Send to user's own account email. | Free tier: 100 emails/day, 3,000/mo |
| `message_inbox` | Send in-app notification | Direct Prisma insert into `AgentMessage`. Already designed in §3. | Free |
| `note_write` | Write a note/task | Direct Prisma insert into `Task`. Already in `task.service.ts`. | Free |

#### PRODUCTIVITY TOOLS (actions)

| Tool | What it does | Cheapest implementation | Cost |
|------|-------------|------------------------|------|
| `task_create` | Create a new task | `task.service.createTask()` — already implemented. | Free |
| `task_move` | Move task between columns | `task.service.moveTask()` — already implemented. | Free |
| `appointment_create` | Create calendar entry | `appointment.service` — already implemented. | Free |

#### AI TOOLS (meta)

| Tool | What it does | Cheapest implementation | Cost |
|------|-------------|------------------------|------|
| `summarize` | Summarize long text | LLM call via user's own `ModelKey` — no extra cost to us. | User pays their API |
| `classify` | Classify/prioritize text | LLM call via user's own `ModelKey`. | User pays their API |

### Permission Matrix (runtime guard)

At execution time, the agent runner enforces the permission matrix:

```
Agent A has tools: [web_search: ON, gmail_read: ON, email_send: OFF, notes_read: ON]

→ Agent can: search the web, read emails, read notes
→ Agent CANNOT: send emails, write notes, create tasks, modify calendar
```

The guard is **server-side, non-bypassable**. Even if the LLM somehow requests a tool call
for a tool the agent doesn't have access to, the runner rejects it before execution.

```typescript
// Pseudocode: agent.runner.ts
async function runAgent(agentId: string) {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    include: { tools: { where: { enabled: true } }, modelKey: true },
  })

  const allowedTools = new Set(agent.tools.map(t => t.toolName))
  const toolDefinitions = TOOL_REGISTRY
    .filter(t => allowedTools.has(t.name))
    .map(t => t.toDeepSeekFunction())  // convert to DeepSeek function calling format

  // Build context from consented data sources
  const context = await gatherContext(agent)

  // Call LLM with only the tools the agent is allowed to use
  const response = await callLLM(agent.modelKey, agent.prompt, context, toolDefinitions)

  // If LLM returns tool calls, execute only allowed ones
  if (response.toolCalls) {
    for (const call of response.toolCalls) {
      if (!allowedTools.has(call.name)) {
        // Log the rejection, skip silently
        continue
      }
      await executeTool(call.name, call.args, agent)
    }
  }

  // Deliver output
  await deliverOutput(agent, response)
}
```

### Tool Configuration UX (Layer 4 detail, previewed here)

Each tool can have optional config exposed as simple controls:

| Tool | Config options | UI |
|------|---------------|-----|
| `web_search` | `maxResults` (1-10, default 3) | Slider |
| `email_read` | `maxEmails` (1-20, default 5), `daysBack` (1-30, default 1) | Two sliders |
| `email_send` | — | Just the toggle |
| `notes_read` | `statusFilter` (todo/doing/done/all), `priorityFilter` | Checkbox group |
| `diary_read` | `daysBack` (1-30, default 3) | Slider |

---

## 6. Layer 4 — Frontend

### 6.1 Agent Editor (reworked)

The current `AgentEditor.tsx` stays as the base. Add three new sections below the existing
Identity/Preferences fields:

#### Section: "What can they access?" (Tools)

A grid of toggle cards, grouped by category:

```
┌─ DATA ──────────────────────────────┐
│  🌐 Internet Search    [toggle]     │
│  📧 Read Emails        [toggle]     │
│  📝 Notes Board        [toggle]     │
│  📅 Calendar           [toggle]     │
│  📓 Diary              [toggle]     │
│  🔗 Custom URLs        [toggle]     │
├─ OUTPUT ────────────────────────────┤
│  📬 In-App Message     [toggle]     │
│  📝 Write Note         [toggle]     │
│  📧 Send Email         [toggle]     │
│  ✅ Create Task        [toggle]     │
└─────────────────────────────────────┘
```

- Toggling ON a tool that requires OAuth (e.g. `gmail_read`) → shows a "Connect Gmail"
  button that initiates the OAuth flow. Tool stays OFF until OAuth completes.
- Toggling ON shows the tool's config options (sliders, dropdowns) inline below the card.
- Toggling OFF hides config options.
- **Safety default**: all tools OFF except `message_inbox`. User must explicitly grant access.

#### Section: "How smart?" (Model)

A compact picker:

```
Model:  [DeepSeek Chat ▾]  [Edit key →]
```

- Dropdown: lists the user's saved `ModelKey` entries. First-time users see a CTA:
  "Add your API key to unlock agent intelligence."
- "Edit key" opens a small modal: provider dropdown (DeepSeek, OpenAI, Anthropic, Groq),
  paste API key, pick default model, name the key.
- Key is sent to backend immediately (encrypted at rest). Frontend never stores the raw key
  after the POST request.
- **DeepSeek is the recommended default** — cheapest by far ($0.14/M input, $0.28/M output).

#### Section: "Safety" (existing draftOnly, enhanced)

```
☑ Draft mode — agent shows you before doing anything
Monthly token budget: [500,000 ▾] (warns at 80%, stops at 100%)
```

### 6.2 Agent Inbox

A new tab in the agents page (or a panel): messages from agents. Each message shows:
- Agent name + icon
- Title + body (rendered markdown)
- Timestamp
- "Mark as read" on click

This reuses `AgentMessage` from §3. Later it can evolve into a general notification table.

### 6.3 Execution Log

A collapsible "Run History" section on each agent's page. Shows:
- Run ID, status (success/failed/running), timestamp
- Tokens used, duration
- Expandable: shows input snapshot, output snapshot, and tool calls with results
- This is the debugging surface — "why did it do that?"

---

## 7. Agent Execution Pipeline

The full lifecycle of a single agent run:

```
1. TRIGGER
   ├── Manual: POST /api/agents/:id/run
   └── Scheduled: cron sweep picks agent where nextRunAt <= now

2. LOAD
   ├── Fetch Agent + AgentTools (enabled only) + ModelKey
   ├── Validate ModelKey exists and provider is set
   └── Create AgentRun row (status: "running")

3. GATHER CONTEXT
   ├── For each consented data source (sources[]):
   │   ├── notes → task.service.listTasks(db, userId)
   │   ├── calendar → appointment.service.listAppointments(db, userId)
   │   ├── diary → diary.service.listDiaryEntries(db, userId, { hidden: false })
   │   ├── email → gmail API (via IntegrationAccount, read-only)
   │   └── urls → web_fetch each URL, extract text
   └── Combine into context string (truncate to maxTokens * 3 to leave room for output)

4. BUILD PROMPT
   ├── System: agent persona (name, role, description, preferences) + safety rules
   │   "You are {name}, a {role}. {description}. Rules: {preferences}."
   │   "You can ONLY use the tools listed below. Do not attempt other actions."
   ├── User: agent's custom prompt (if any) + context snapshot
   └── Tools: DeepSeek function definitions (only enabled tools)

5. CALL LLM
   ├── POST https://api.deepseek.com/chat/completions (or user's chosen provider)
   ├── model: agent.modelKey.defaultModel
   ├── tools: filtered function definitions
   ├── max_tokens: agent.maxTokens
   └── Handle: rate limits, timeouts, invalid responses → log + fail gracefully

6. TOOL LOOP (max 5 iterations to prevent runaway)
   ├── If LLM returns tool_calls:
   │   ├── For each tool_call:
   │   │   ├── Check allowedTools.has(tool_call.name) → reject if not
   │   │   ├── Execute tool (see §5 implementations)
   │   │   └── Append result to conversation
   │   └── Call LLM again with updated context
   └── If LLM returns content (no tool calls) → done, proceed to step 7

7. DELIVER OUTPUT
   ├── Based on agent.output:
   │   ├── message → INSERT INTO AgentMessage
   │   ├── note → task.service.createTask(db, userId, { title, text: output })
   │   └── email → email.service.send({ to: userEmail, subject, html })
   └── If agent.draftOnly → deliver as "Draft: ..." prefix, don't auto-send

8. LOG & CLEANUP
   ├── Update AgentRun: status, outputSnap, toolCalls, tokensUsed, finishedAt
   ├── Update Agent: lastRunAt, nextRunAt (if scheduled), runCount++
   └── Check daily token budget → warn/stop if exceeded
```

---

## 8. BYOK — Bring Your Own Key

### Why BYOK

- **Zero LLM cost for OnTrack** — user pays their own API usage.
- **User trust** — they control their keys, can revoke anytime.
- **Flexibility** — user picks the model that fits their budget and use case.
- **Simplicity** — no billing system, no usage metering on our end (just token counting
  for budget guardrails).

### Supported Providers (cheapest first)

| Provider | Model | Input cost | Output cost | Notes |
|----------|-------|-----------|-------------|-------|
| **DeepSeek** | `deepseek-chat` | $0.14/M | $0.28/M | **Recommended default** — cheapest capable model |
| **DeepSeek** | `deepseek-reasoner` | $0.55/M | $2.19/M | For complex reasoning tasks |
| **Groq** | `llama-3.3-70b` | $0.059/M | $0.079/M | Fastest inference, very cheap |
| **OpenAI** | `gpt-4o-mini` | $0.15/M | $0.60/M | Good balance, widely used |
| **Anthropic** | `claude-3-haiku` | $0.25/M | $1.25/M | Best instruction following |
| **OpenRouter** | Various | Varies | Varies | Aggregator, supports many models via one key |

### Key Storage

- User pastes API key in the frontend → `POST /api/model-keys`
- Backend encrypts with `MODEL_KEY_ENCRYPTION_KEY` (Worker secret, AES-256-GCM)
- Stored as `apiKeyEnc` in `ModelKey` table
- Decrypted only at LLM call time, never logged, never returned in API responses
- Same pattern as `IntegrationAccount.tokenEnc` (already designed in original doc §5)

### Key Validation

On `POST /api/model-keys`, immediately validate the key by making a minimal API call
(e.g. list models or a tiny chat completion). If it fails, return the error to the user
so they know the key is invalid before they create an agent with it.

---

## 9. Cost Guardrails

- **Per-run token cap**: `Agent.maxTokens` (default 2000, configurable up to 8000)
- **Daily budget**: user sets a monthly token budget (stored in `ModelKey` or user prefs);
  backend tracks cumulative `AgentRun.tokensUsed` per day
- **Hard stop**: when budget exceeded, agent runs return `429 BUDGET_EXCEEDED` — no LLM call
- **Warning**: at 80% of budget, in-app notification + email alert
- **Cost estimate**: before each run, estimate cost based on input size + maxTokens × model
  price → show "Estimated cost: ~$0.002" in the run confirmation

---

## 10. What NOT to build now (YAGNI)

- Multi-agent conversations, agent memory/RAG, plugin marketplaces, agent-to-agent messaging.
- Natural-language agent creation ("make me an agent that…") — the toggle-based editor
  already abstracts that.
- Streaming to client — server-side execution is simpler and cheaper.
- Custom tool creation by users — fixed catalogue covers the use cases.
- Deliveries to Slack/Telegram/WhatsApp — email + in-app covers this app's surface.

---

## 11. Roadmap (each phase shippable on its own)

- **Phase 0 — make the template real:** agents CRUD API + optimistic store sync (exact copy of
  the tasks pattern). Value: agents finally persist across devices. No runtime yet.
- **Phase 1 — BYOK + "Run now" with in-app data only:** manual trigger, sources = notes/calendar/diary
  (no external), output = `message` only. User adds a DeepSeek key, creates an agent with tool
  toggles, hits "Run". This is a full loop with zero OAuth and zero scheduling.
- **Phase 1.5 — Scheduling:** cron sweep + `nextRunAt` fan-out. Adds "at the start of the day"
  behavior with no external dependency.
- **Phase 2 — Email summarizer (flagship):** Gmail OAuth, `email_read` + `email_send` tools,
  output to `message` + optional `email` via Resend.
- **Phase 3 — Job search links:** `web_fetch` on saved URL list, weekly digest output as
  `note` or `email`. Keep the phantom-URL fetch on the worker, never on the client.
- **Phase 4 — Web search:** integrate `web_search` tool (SearXNG or Tavily), unlock
  internet-access agents.

---

## 12. Open questions — decide before Phase 1

1. **DeepSeek key format:** DeepSeek API uses the OpenAI-compatible format
   (`https://api.deepseek.com/v1/chat/completions`). Should we standardize on OpenAI's
   format for all providers (most use it anyway) and just swap `baseUrl` + `apiKey`?
2. **In-app delivery:** dedicated "Agents" inbox (needs `AgentMessage` UI + red dot on nav)
   vs. write outputs into Notes as tasks (zero new UI, but pollutes the board). I lean inbox.
3. **"Draft vs. send"** default for `note`/`email` outputs — recommend `draftOnly: true` by
   default.
4. **Gmail OAuth** requires a Google Cloud OAuth client + redirect URI — do you have one, or
   should Phase 2 use "forward your daily digest email to a bot address" as a hack-free
   alternative first?
5. **Tool limit:** should we cap the number of tools an agent can use simultaneously (e.g.
   max 5) to keep prompts small and costs down?

---

## 13. Housekeeping when we build it

- Keep `DATAMODEL.md` in sync (§ entities + §4 routes + §3 schema) — it's the contract.
- Files follow the repo layout: `agents.controller.ts` / `agents.router.ts` / `agents.service.ts`
  (+ `agent.runner.ts`), `model-keys.controller.ts` / `model-keys.service.ts`,
  `tools.service.ts` (tool registry + execution), `ai.interface.ts` + `ai.service.ts`.
- Env secrets: `MODEL_KEY_ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, Google OAuth
  client id/secret; all in `.dev.vars` locally, Worker secrets at deploy, never in the repo.
- Dashboard widget: date-locked — add an "Agents" widget only after the inbox exists (§12.2).
