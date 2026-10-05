# Smartsheet Desktop

Unofficial Electron shell around the Smartsheet web app. Same site, fewer browser chrome distractions, tabs that survive a restart.

Not affiliated with Smartsheet Inc. If something breaks, the web app is still at [app.smartsheet.com](https://app.smartsheet.com). Survival odds of that being true: high.

## Features

- Multiple windows and tabs (cap: 100 per window)
- Restores windows, tab URLs, and bounds on launch
- Smartsheet links open in-app; login/SSO popups stay as popups; everything else goes to the system browser
- Persistent login via a dedicated Electron session partition
- macOS dock badge from unread counts in tab titles
- Drag-to-reorder tabs; right-click to duplicate, move to a new window, or open in the browser

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm

## Setup

```bash
nvm use
npm install
npm start
```

`npm run build` compiles TypeScript to `dist/` without launching Electron. `npm run dev` is an alias for `npm start`.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| New tab | `Cmd/Ctrl+T` |
| New window | `Cmd/Ctrl+N` |
| Close tab | `Cmd/Ctrl+W` |
| Reload | `Cmd/Ctrl+R` |
| Cycle tabs | `Cmd/Ctrl+Tab` / `Cmd/Ctrl+Shift+Tab` |
| Open home | `Cmd/Ctrl+Shift+H` |

## License

MIT
