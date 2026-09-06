# AGENTS.md

Turborepo + npm workspaces monorepo. Renderer is a browser app; the Electron shell wraps it; a Cloudflare Worker serves the API; a builder packages the desktop app. All commands run from the repo root.

## Layout

- `apps/web` — React 19 + Vite 5 renderer. Dev server on port **3000**. Tailwind **v4** via `@tailwindcss/vite` — there is **no `tailwind.config`**; styles come from `@import "tailwindcss"` in `src/index.css`.
- `apps/app` — Electron shell. Built with `vite-plugin-electron` via `build.mjs` (there is **no `vite.config.ts`** here). Compiles `src/main` + `src/preload` into `dist/`; preload is emitted as `index.mjs` (see `build.mjs` `[name].mjs`).
- `apps/backend` — Hono app deployed as a Cloudflare Worker. Config is `wrangler.jsonc` (not `wrangler.toml`); local secrets go in `.dev.vars`.
- `apps/builder` — Packaging step only: copies `../app/dist` → `dist-desktop` and `../web/dist` → `dist-web`, then `electron-builder` (Windows portable, `signAndEditExecutable: false`). Depends on both builds being done first.
- `DATAMODEL.md` (root) — the data contract between frontend stores and the future Postgres/Prisma backend. Entities, field shapes, proposed Prisma schema, and REST endpoints all live there. Read it before touching backend or entity-typed frontend code.
- `packages/eslint-config-turbotron` — shared ESLint 9 flat presets: `node.eslint.mjs` (app) and `web.eslint.mjs` (web), consumed via flat config imports. No root eslint config.

## Commands

- `npm run dev` — runs **all three** dev tasks concurrently via turbo: web (vite:3000), app (Electron, loads `http://localhost:3000/`), and backend (`wrangler dev`, requires a Cloudflare login). To run just one: `npm run dev -w web` / `-w app` / `-w backend`.
- `npm run build` — turbo order is web → app → builder (encoded in `turbo.json` as `web#build` → `app#build` → `build`). Do not run `apps/builder` build directly unless app and web dists exist.
- `npm run lint` — covers **only** web and app; backend/builder have no lint script.
- `npm run format` — prettier with the `@goatee/prettier` config from root `package.json`.
- **No `typecheck` script exists.** Type errors surface only through builds: `npm run build -w web` (`tsc -b`) and `npm run build -w app` (`tsc`).
- Backend: `npm run deploy -w backend` (`wrangler deploy --minify`); after editing bindings in `wrangler.jsonc`, run `npm run cf-typegen -w backend` to regenerate the `CloudflareBindings` type.

## Conventions & gotchas

- `apps/web` uses `HashRouter` (not BrowserRouter) — required for Electron `file://` loading. Keep it.
- App production main loads `../../dist-web/index.html` relative to `dist/main`, so the packaged layout is `dist-desktop/` + sibling `dist-web/`. Don't move those paths.
- `BrowserWindow` has `nodeIntegration: true`; preload runs via `index.mjs`.
- Dashboard: a second frameless `BrowserWindow` (340×440) at screen `(0,0)`, always-on-top, skip-taskbar, created at startup. It loads the web app with query `?widget=1` + hash `#/dashboard` — the web app switches to a standalone widget layout (`DashboardWindow`) when that query flag is present. Wedges are derived from sidebar tabs (Today, Notes, Agents, Diary, Timer, Calendar); the widget header has buttons to open the main app (`dashboard:show-main`) and hide (`dashboard:close`). The main-app Dashboard page is the manager (toggle wedges + live preview); the window mirrors only the enabled set, compact. Widget config lives in the `ontrack-dashboard` zustand store; `enableCrossWindowSync()` (called in `main.tsx`) rehydrates all `ontrack-*` stores across windows on the `storage` event.
- A system tray icon exists: closing the main window hides it to tray (doesn't quit); tray menu has Show Dashboard / Show OnTrack / Quit. `isQuitting` must be set (`before-quit`) for windows to actually close.
- Preload exposes `window.ontrack.closeDashboard()` (IPC `dashboard:close` → hides the dashboard window). Web's `vite-env.d.ts` declares the `ontrack` global.
- Backend is a minimal Hono app; `wrangler.jsonc` bindings (KV, D1, etc.) are commented out as templates — uncomment and run `cf-typegen` after enabling any.

## Rules

- Never install a new dependency without asking the user first — and before installing, verify it is compatible with the current setup (React 19, Vite 5, Tailwind v4, TypeScript, Node/npm versions).
- Keep `DATAMODEL.md` in sync: any change to the backend (endpoints, Prisma models, request/response shapes, bindings) **or** any change to a frontend entity's shape (zustand store types / persisted `ontrack-*` keys) must be reflected in `DATAMODEL.md` in the same change. If you touch one side without the other, note the mismatch there.