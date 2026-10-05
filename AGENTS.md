# AGENTS.md

Unofficial Electron desktop shell for the Smartsheet web app. TypeScript, no bundler, no UI framework. Keep it that way unless the user asks otherwise.

This is not an official Smartsheet product. Do not add branding, APIs, or telemetry that imply affiliation.

## Commands

- Node 24 (`.nvmrc`). Use `nvm use` before install/run.
- `npm install` — dependencies (`electron`, `electron-builder`, `typescript`, `@types/node`).
- `npm run build` — `tsc` (main/preload) then `tsc -p tsconfig.renderer.json`, then copy `src/renderer/index.html` and `index.css` into `dist/renderer/`.
- `npm start` / `npm run dev` — build, then launch Electron.
- `npm run dist:mac` — compile, then electron-builder universal DMG + PKG into `release/` (do not use builder's default `dist/` output; that collides with `tsc`). App icon is `build/icon.png`.

Do not commit `dist/`, `release/`, `node_modules/`, or Electron `userData` artifacts (`session.json`, cookies, caches).

## Layout

| Path | Role |
| --- | --- |
| `src/main.ts` | App lifecycle, native menu, quit persistence |
| `src/windows.ts` | `BaseWindow` + `WebContentsView` chrome and tabs, IPC handlers, session partition |
| `src/preload.ts` | `contextBridge` API (`window.desktop`) |
| `src/urls.ts` | Smartsheet vs auth-popup vs external URL policy |
| `src/store.ts` | Load/save window/tab snapshot under `app.getPath("userData")` |
| `src/types.ts` | Shared constants (`HOME_URL`, `MAX_TABS`, `SESSION_PARTITION`) and types |
| `src/renderer/` | Tab chrome UI (vanilla HTML/CSS/TS). Compiled separately. |
| `src/renderer/global.d.ts` | Renderer typings for `window.desktop` |

Main process: CommonJS, `rootDir` `src`, excludes `src/renderer/**`. Renderer: ES2022 modules into `dist/renderer`. After changing renderer HTML/CSS, the copy step in `build` must still run.

## Architecture rules

- Chrome lives in one `WebContentsView`; each tab is another `WebContentsView` on the same `BaseWindow`. Layout: chrome strip on top (`CHROME_HEIGHT`), tab content below.
- Tab pages use `partition: persist:smartsheet`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Do not reverse those.
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
