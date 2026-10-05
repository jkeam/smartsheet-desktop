# AGENTS.md

Unofficial Electron desktop shell for the Smartsheet web app. TypeScript, no bundler, no UI framework. Keep it that way unless the user asks otherwise.

This is not an official Smartsheet product. Do not add branding, APIs, or telemetry that imply affiliation.

## Commands

- Node 24 (`.nvmrc`). Use `nvm use` before install/run.
- `npm install` — dependencies (`electron`, `electron-builder`, `typescript`, `@types/node`).
- `npm run build` — `tsc` (main/preload) then `tsc -p tsconfig.renderer.json`, then copy `src/renderer/index.html`, `index.css`, and `error.html` into `dist/renderer/`.
- `npm start` / `npm run dev` — build, then launch Electron.
- `npm test` — Node built-in test runner on `test/**/*.ts` (URL policy). Uses `--experimental-strip-types`.
- `npm run dist:mac` — compile, then electron-builder universal DMG + PKG into `release/` (do not use builder's default `dist/` output; that collides with `tsc`). App icon is `build/icon.png`. CI sets `CSC_IDENTITY_AUTO_DISCOVERY=false` for unsigned builds.

Do not commit `dist/`, `release/`, `node_modules/`, or Electron `userData` artifacts (`session.json`, cookies, caches).

## Layout

| Path | Role |
| --- | --- |
| `src/main.ts` | App lifecycle, native menu, quit persistence |
| `src/windows.ts` | `BaseWindow` + `WebContentsView` chrome and tabs, IPC handlers, session partition, find/downloads/fail |
| `src/preload.ts` | `contextBridge` API (`window.desktop`) for chrome |
| `src/tab-preload.ts` | Minimal bridge for tab error page (`openExternal`) |
| `src/urls.ts` | Smartsheet vs auth-popup vs external URL policy |
| `src/store.ts` | Load/save window/tab snapshot under `app.getPath("userData")` |
| `src/types.ts` | Shared constants (`HOME_URL`, `MAX_TABS`, `SESSION_PARTITION`) and types |
| `src/renderer/` | Tab chrome UI (vanilla HTML/CSS/TS). Compiled separately. |
| `src/renderer/error.html` | Local fail page loaded into a tab view (copied on build) |
| `src/renderer/global.d.ts` | Renderer typings for `window.desktop` |
| `test/` | Node unit tests (excluded from main `tsc`) |
| `.github/workflows/ci.yml` | `test` job + unsigned `dist-mac` artifact upload |

Main process: CommonJS, `rootDir` `src`, excludes `src/renderer/**`. Renderer: ES2022 modules into `dist/renderer`. After changing renderer HTML/CSS (including `error.html`), the copy step in `build` must still run.

## Architecture rules

- Chrome lives in one `WebContentsView`; each tab is another `WebContentsView` on the same `BaseWindow`. Layout: tab strip (`TAB_STRIP_HEIGHT`) plus optional find bar (`FIND_BAR_HEIGHT`) on top; tab content below.
- Find bar state is per window (`shellWin.find`), not persisted. Main runs `findInPage` / `stopFindInPage` on the active tab.
- Closed tabs are an in-memory stack (last ~20 URLs) for `Cmd+Shift+T`. Not persisted.
- On `did-fail-load` (main frame, not `ERR_ABORTED`), keep `tab.url` as the failed Smartsheet URL and load `error.html` so `session.json` never stores `file://`.
- Downloads: `session.will-download` saves under `app.getPath("downloads")` with a unique name; notify on completion.
- Tab pages use `partition: persist:smartsheet`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Do not reverse those. Auth popups should match those prefs.
- Renderer talks to main only through `window.desktop` / IPC channels already defined in `preload.ts`. Add a preload method and `global.d.ts` together if you add a channel.
- Smartsheet app URLs open as tabs. Auth/SSO URLs may open as popups (same partition). All other URLs go to `shell.openExternal`. Change that policy in `src/urls.ts`, not ad hoc in handlers.
- Cap is `MAX_TABS` (100) per window. Closing the last tab in the last window opens home; extra windows close when they have no tabs.
- Persist via `schedulePersist` / `persistNow` (`session.json` in userData). Do not persist cookies or page content in the repo.

## Code style

- Strict TypeScript. Prefer explicit types on exported functions and IPC payloads.
- No React/Vue/Svelte. Tab chrome is DOM APIs in `src/renderer/index.ts`.
- Match existing naming: `shellWin` for window wrappers, `Tab` vs `TabState` (runtime vs IPC).
- macOS-first chrome (`titleBarStyle: "hiddenInset"`, traffic lights). Keep Windows/Linux chrome height (`44` vs `52`) if you touch layout.
- User-agent is set in `configureSession`. Changing it can break Smartsheet; do not bump casually.

## Security

- Never enable `nodeIntegration` in tab or chrome views.
- Do not load arbitrary URLs into tab views; run them through `normalizeAppUrl` / `isSmartsheetAppUrl`.
- Keep the renderer CSP in `index.html` tight. No `unsafe-eval`.
- This app wraps a third-party site. Do not scrape, automate, or proxy Smartsheet APIs unless the user explicitly asks.
