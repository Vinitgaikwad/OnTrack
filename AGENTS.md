# AGENTS.md

Turborepo + npm workspaces. All commands from repo root. Layout: `apps/web` (React 19 + Vite 5, port 3000, Tailwind v4 — no tailwind.config), `apps/app` (Electron; build via `build.mjs` → `dist/`, preload is `index.mjs`), `apps/backend` (Hono / Cloudflare Worker; `wrangler.jsonc`, secrets in `.dev.vars`), `apps/builder` (packs `dist-web` + `dist-desktop` after app+web builds), `DATAMODEL.md` (contract between stores and backend — read before backend/entity work), `packages/eslint-config-turbotron` (flat configs; no root eslint config).

## Commands
- `npm run dev` — web (3000) + app + backend (`wrangler dev`, needs Cloudflare login); per-workspace: `-w web` / `-w app` / `-w backend`.
- `npm run build` — turbo order web → app → builder; never run builder directly without both dists first.
- `npm run lint` — web and app only; `npm run format` — prettier.
- No typecheck script: type errors surface via `npm run build -w web` / `-w app`.
- Backend: `npm run deploy -w backend`; after `wrangler.jsonc` binding changes, run `npm run cf-typegen -w backend`.

## Gotchas
- HashRouter; auth routes hyphenated (`#/sign-in`); dashboard widget = `?widget=1` + `#/dashboard`; tray + `isQuitting` before-quit; preload exposes `window.ontrack.closeDashboard()`. App calls go through Vite proxy `/api` → **8787**; backend must run or requests fail "Failed to fetch".
- Notes board in `ontrack-notes` / `useNotesStore` is `Record<TaskStatus, NoteTask[]>` (object, not array — don't `.map`).

## Notes drag (do not regress)
- Board is frozen while dragging: only the pinned/hidden in-flow copy and the portaled `DragGhost` move. Reorder exactly once in `handleDragEnd` (pointer-targeted collisions: card-first, column fallback), then `commitRowMove`.
- Never call `moveTask`/`setState` from `handleDragOver` — `pointerWithin` returns card+column every frame, `over` flips, each flip reorders → `Maximum update depth exceeded` → tree unmounts mid-drag.
- `DragGhost`: `createPortal(document.body)` fixed, source rect via `[data-task-id]`, grab-offset latched on first `pointermove`, rAF-throttled. Portal is the pattern — in-tree `fixed` here measures +232/+93 shifted.
- dnd-kit measured rects are unreliable in this app — treat a rect as a symptom, never root-cause proof, until an experiment isolates the mechanism.

## Debugging (browser)
- Every Playwright probe attaches `pageerror` + `console` + `requestfailed` capture before the first assertion.
- One probe per feature in `%TEMP%\opencode\` via the `webapp-testing` `with_server.py` harness, deleted when done. No inline PowerShell heredocs.
- Change one variable per run; when two theories survive, bisect — don't pile on another theory.
- Assert against data (localStorage board, API responses), never page text.
- Skills by job: `systematic-debugging` on bugs, `verification-before-completion` before claiming fixed, `webapp-testing` for browser interaction.

## Rules
- Never install a dependency without asking; verify compat first (React 19, Vite 5, Tailwind v4, TS, Node/npm).
- Keep `DATAMODEL.md` in sync with backend or entity-shape changes; note the mismatch otherwise.