import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { PersistedWindow } from "./types";

const FILE = () => path.join(app.getPath("userData"), "session.json");

export type AppSession = {
  windows: PersistedWindow[];
};

export function loadSession(): AppSession {
  try {
    const raw = fs.readFileSync(FILE(), "utf8");
    const parsed = JSON.parse(raw) as AppSession;
    if (!parsed.windows?.length) return defaultSession();
    return parsed;
  } catch {
    return defaultSession();
  }
}

export function saveSession(session: AppSession): void {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(session, null, 2));
}

function defaultSession(): AppSession {
  return {
    windows: [
      {
        width: 1440,
        height: 900,
        tabs: [{ url: "https://app.smartsheet.com" }],
        activeIndex: 0,
      },
    ],
  };
}
