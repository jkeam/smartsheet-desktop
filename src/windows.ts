import {
  BaseWindow,
  Menu,
  WebContentsView,
  app,
  clipboard,
  dialog,
  ipcMain,
  session,
  shell,
} from "electron";
import path from "node:path";
import { loadSession, saveSession, type AppSession } from "./store";
import {
  HOME_URL,
  MAX_TABS,
  SESSION_PARTITION,
  type TabState,
  type WindowState,
} from "./types";
import {
  isAuthPopupUrl,
  isSmartsheetAppUrl,
  normalizeAppUrl,
  titleFromUrl,
} from "./urls";

type Tab = {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  favicon: string | null;
  loading: boolean;
};

type ShellWindow = {
  id: number;
  win: BaseWindow;
  chromeView: WebContentsView;
  tabs: Tab[];
  activeId: string | null;
};

const CHROME_HEIGHT = process.platform === "darwin" ? 52 : 44;

const shells = new Map<number, ShellWindow>();
let persistTimer: NodeJS.Timeout | null = null;
let quitting = false;

export function registerIpc(): void {
  ipcMain.handle("tabs:getState", (event) => {
    const shellWin = liveShellFromEvent(event);
    return shellWin ? windowState(shellWin) : { tabs: [], canGoBack: false, canGoForward: false };
  });
  ipcMain.on("tabs:new", (event, url?: string) => {
    const shellWin = liveShellFromEvent(event);
    if (shellWin) addTab(shellWin, normalizeAppUrl(url));
  });
  ipcMain.on("tabs:close", (event, tabId: string) => {
    const shellWin = liveShellFromEvent(event);
    if (shellWin) closeTab(shellWin, tabId);
  });
  ipcMain.on("tabs:activate", (event, tabId: string) => {
    const shellWin = liveShellFromEvent(event);
    if (shellWin) activateTab(shellWin, tabId);
  });
  ipcMain.on("tabs:reorder", (event, orderedIds: string[]) => {
    const shellWin = liveShellFromEvent(event);
    if (!shellWin) return;
    shellWin.tabs.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    pushState(shellWin);
    schedulePersist();
  });
  ipcMain.on("tabs:home", (event) => {
    const shellWin = liveShellFromEvent(event);
    if (!shellWin) return;
    const active = activeTab(shellWin);
    if (active && viewLive(active.view)) active.view.webContents.loadURL(HOME_URL);
    else addTab(shellWin, HOME_URL);
  });
  ipcMain.on("tabs:reload", (event) => {
    const tab = activeTab(liveShellFromEvent(event));
    if (tab && viewLive(tab.view)) tab.view.webContents.reload();
  });
  ipcMain.on("tabs:back", (event) => {
    const tab = activeTab(liveShellFromEvent(event));
    if (navigationFlag(tab, "canGoBack")) tab?.view.webContents.navigationHistory.goBack();
  });
  ipcMain.on("tabs:forward", (event) => {
    const tab = activeTab(liveShellFromEvent(event));
    if (navigationFlag(tab, "canGoForward")) tab?.view.webContents.navigationHistory.goForward();
  });
  ipcMain.on("tabs:duplicate", (event, tabId: string) => {
    const shellWin = shellFromEvent(event);
    if (!shellWin) return;
    const tab = shellWin.tabs.find((t) => t.id === tabId);
    if (tab) addTab(shellWin, tab.url);
  });
  ipcMain.on("tabs:move-new-window", (event, tabId: string) => {
    const shellWin = shellFromEvent(event);
    if (!shellWin) return;
    const tab = shellWin.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const url = tab.url;
    closeTab(shellWin, tabId);
    createWindow({ tabs: [{ url }], activeIndex: 0, width: 1280, height: 800 });
  });
  ipcMain.on("tabs:open-in-browser", (event, tabId: string) => {
    const shellWin = shellFromEvent(event);
    const tab = shellWin?.tabs.find((t) => t.id === tabId);
    if (tab) void shell.openExternal(tab.url);
  });
}

export function restoreWindows(): void {
  const saved = loadSession();
  if (!saved.windows.length) {
    createWindow();
    return;
  }
  for (const windowState of saved.windows) {
    createWindow(windowState);
  }
}

export function createWindow(
  persisted?: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized?: boolean;
    tabs: { url: string }[];
    activeIndex: number;
  }
): ShellWindow {
  const win = new BaseWindow({
    width: persisted?.width ?? 1440,
    height: persisted?.height ?? 900,
    x: persisted?.x,
    y: persisted?.y,
    minWidth: 800,
    minHeight: 500,
    title: "Smartsheet Desktop",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: "#ececec",
    show: false,
  });

  const chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const shellWin: ShellWindow = { id: win.id, win, chromeView, tabs: [], activeId: null };
  shells.set(win.id, shellWin);
  chromeView.setBackgroundColor("#e8e8e8");
  win.contentView.addChildView(chromeView);

  win.on("show", () => layout(shellWin));
  win.on("closed", () => {
    // `win.id` throws after destroy; use the copy captured at create time.
    shells.delete(shellWin.id);
    schedulePersist();
  });
  win.on("resize", () => layout(shellWin));
  win.on("enter-full-screen", () => layout(shellWin));
  win.on("leave-full-screen", () => layout(shellWin));
  win.on("moved", () => schedulePersist());
  win.on("resized", () => schedulePersist());

  void chromeView.webContents.loadFile(path.join(__dirname, "renderer", "index.html"));
  chromeView.webContents.on("did-finish-load", () => {
    if (quitting || !windowLive(win)) return;
    layout(shellWin);
    pushState(shellWin);
    if (persisted?.isMaximized) win.maximize();
    win.show();
  });

  const tabs = persisted?.tabs?.length
    ? persisted.tabs
    : [{ url: HOME_URL }];
  for (const tab of tabs.slice(0, MAX_TABS)) {
    addTab(shellWin, normalizeAppUrl(tab.url), { activate: false });
  }
  const active = shellWin.tabs[Math.min(persisted?.activeIndex ?? 0, shellWin.tabs.length - 1)];
  if (active) activateTab(shellWin, active.id);

  return shellWin;
}

export function newTabInFocusedWindow(url?: string): void {
  const shellWin = focusedShell() ?? [...shells.values()][0];
  if (shellWin) addTab(shellWin, normalizeAppUrl(url));
  else createWindow();
}

export function closeActiveTab(): void {
  const shellWin = focusedShell();
  if (!shellWin?.activeId) return;
  closeTab(shellWin, shellWin.activeId);
}

export function reloadActiveTab(): void {
  const tab = activeTab(focusedShell());
  if (tab && viewLive(tab.view)) tab.view.webContents.reload();
}

export function persistNow(): void {
  if (quitting) return;
  saveSession(snapshot());
}

/** Persist while windows are still alive, then ignore teardown events. */
export function prepareQuit(): void {
  if (quitting) return;
  quitting = true;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  saveSession(snapshot());
}

function shellFromEvent(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
): ShellWindow | undefined {
  for (const shellWin of shells.values()) {
    if (!viewLive(shellWin.chromeView)) continue;
    if (shellWin.chromeView.webContents.id === event.sender.id) {
      return shellWin;
    }
  }
  return undefined;
}

function liveShellFromEvent(
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
): ShellWindow | undefined {
  if (quitting) return undefined;
  const shellWin = shellFromEvent(event);
  if (!shellWin || !windowLive(shellWin.win)) return undefined;
  return shellWin;
}

function focusedShell(): ShellWindow | undefined {
  const win = BaseWindow.getFocusedWindow();
  return win ? shells.get(win.id) : undefined;
}

function activeTab(shellWin: ShellWindow | undefined): Tab | undefined {
  if (!shellWin?.activeId) return undefined;
  return shellWin.tabs.find((t) => t.id === shellWin.activeId);
}

function addTab(
  shellWin: ShellWindow,
  url: string,
  options: { activate?: boolean } = {}
): Tab | null {
  if (shellWin.tabs.length >= MAX_TABS) {
    void dialog.showMessageBox(shellWin.win, {
      type: "warning",
      message: "Tab limit reached",
      detail: `This window already has ${MAX_TABS} tabs.`,
    });
    return null;
  }

  const view = new WebContentsView({
    webPreferences: {
      partition: SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const tab: Tab = {
    id: crypto.randomUUID(),
    view,
    title: titleFromUrl(url),
    url,
    favicon: null,
    loading: true,
  };

  bindTabEvents(shellWin, tab);
  shellWin.win.contentView.addChildView(view);
  shellWin.tabs.push(tab);
  view.webContents.loadURL(url);

  if (options.activate !== false) activateTab(shellWin, tab.id);
  else {
    view.setVisible(false);
    pushState(shellWin);
  }
  layout(shellWin);
  schedulePersist();
  return tab;
}

function bindTabEvents(shellWin: ShellWindow, tab: Tab): void {
  const contents = tab.view.webContents;

  const ifLive = (fn: () => void) => {
    if (quitting || !windowLive(shellWin.win)) return;
    try {
      if (contents.isDestroyed()) return;
    } catch {
      return;
    }
    fn();
  };

  contents.setWindowOpenHandler(({ url }) => {
    if (isSmartsheetAppUrl(url)) {
      addTab(shellWin, url);
      return { action: "deny" };
    }
    if (isAuthPopupUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 920,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: { partition: SESSION_PARTITION },
        },
      };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("page-title-updated", (_event, title) => {
    ifLive(() => {
      tab.title = cleanTitle(title) || titleFromUrl(tab.url);
      pushState(shellWin);
      updateDockBadge();
    });
  });
  contents.on("page-favicon-updated", (_event, favicons) => {
    ifLive(() => {
      tab.favicon = favicons[0] ?? null;
      pushState(shellWin);
    });
  });
  contents.on("did-start-loading", () => {
    ifLive(() => {
      tab.loading = true;
      pushState(shellWin);
    });
  });
  contents.on("did-stop-loading", () => {
    ifLive(() => {
      tab.loading = false;
      tab.url = contents.getURL();
      tab.title = cleanTitle(contents.getTitle()) || titleFromUrl(tab.url);
      pushState(shellWin);
      updateDockBadge();
    });
  });
  contents.on("did-navigate", (_event, url) => {
    ifLive(() => {
      tab.url = url;
      pushState(shellWin);
      schedulePersist();
    });
  });
  contents.on("did-navigate-in-page", (_event, url) => {
    ifLive(() => {
      tab.url = url;
      pushState(shellWin);
      schedulePersist();
    });
  });
  contents.on("context-menu", (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      {
        label: "Copy Link",
        visible: Boolean(params.linkURL),
        click: () => clipboard.writeText(params.linkURL),
      },
      {
        label: "Open Link in New Tab",
        visible: Boolean(params.linkURL) && isSmartsheetAppUrl(params.linkURL),
        click: () => addTab(shellWin, params.linkURL),
      },
      {
        label: "Open Link in Browser",
        visible: Boolean(params.linkURL),
        click: () => void shell.openExternal(params.linkURL),
      },
      { type: "separator" },
      { label: "Back", click: () => contents.navigationHistory.goBack() },
      { label: "Forward", click: () => contents.navigationHistory.goForward() },
      { label: "Reload", click: () => contents.reload() },
      { type: "separator" },
      {
        label: "Open in Browser",
        click: () => void shell.openExternal(contents.getURL()),
      },
    ]);
    menu.popup({ window: shellWin.win });
  });

  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const meta = input.meta || input.control;
    if (meta && input.key.toLowerCase() === "t") {
      event.preventDefault();
      addTab(shellWin, HOME_URL);
    }
    if (meta && input.key.toLowerCase() === "w") {
      event.preventDefault();
      closeTab(shellWin, tab.id);
    }
    if (meta && input.key.toLowerCase() === "n") {
      event.preventDefault();
      createWindow();
    }
    if (meta && input.key.toLowerCase() === "r") {
      event.preventDefault();
      contents.reload();
    }
    if (meta && input.key === "Tab") {
      event.preventDefault();
      cycleTab(shellWin, input.shift ? -1 : 1);
    }
  });
}

function closeTab(shellWin: ShellWindow, tabId: string): void {
  const index = shellWin.tabs.findIndex((t) => t.id === tabId);
  if (index < 0) return;
  const [removed] = shellWin.tabs.splice(index, 1);
  if (removed) destroyTab(shellWin, removed);

  if (shellWin.tabs.length === 0) {
    if (shells.size > 1) {
      shellWin.win.close();
      return;
    }
    addTab(shellWin, HOME_URL);
    return;
  }

  if (shellWin.activeId === tabId) {
    const next = shellWin.tabs[Math.max(0, index - 1)];
    if (next) activateTab(shellWin, next.id);
  } else {
    pushState(shellWin);
    layout(shellWin);
  }
  schedulePersist();
}

function destroyTab(shellWin: ShellWindow, tab: Tab): void {
  try {
    if (windowLive(shellWin.win)) {
      shellWin.win.contentView.removeChildView(tab.view);
    }
  } catch {
    /* view may already be detached */
  }
  if (!viewLive(tab.view)) return;
  try {
    tab.view.webContents.close({ waitForBeforeUnload: false });
  } catch {
    /* already gone */
  }
}

function activateTab(shellWin: ShellWindow, tabId: string): void {
  if (quitting || !windowLive(shellWin.win)) return;
  shellWin.activeId = tabId;
  for (const tab of shellWin.tabs) {
    if (viewLive(tab.view)) tab.view.setVisible(tab.id === tabId);
  }
  const active = shellWin.tabs.find((tab) => tab.id === tabId);
  if (active) {
    shellWin.win.setTitle(active.title || "Smartsheet Desktop");
  }
  layout(shellWin);
  pushState(shellWin);
}

function cycleTab(shellWin: ShellWindow, delta: number): void {
  if (!shellWin.tabs.length) return;
  const index = shellWin.tabs.findIndex((t) => t.id === shellWin.activeId);
  const next = (index + delta + shellWin.tabs.length) % shellWin.tabs.length;
  const tab = shellWin.tabs[next];
  if (tab) activateTab(shellWin, tab.id);
}

function layout(shellWin: ShellWindow): void {
  if (quitting || !windowLive(shellWin.win)) return;
  let width: number;
  let height: number;
  try {
    [width, height] = shellWin.win.getContentSize();
  } catch {
    return;
  }
  if (viewLive(shellWin.chromeView)) {
    shellWin.chromeView.setBounds({
      x: 0,
      y: 0,
      width,
      height: CHROME_HEIGHT,
    });
  }

  const tabBounds = {
    x: 0,
    y: CHROME_HEIGHT,
    width,
    height: Math.max(0, height - CHROME_HEIGHT),
  };
  for (const tab of shellWin.tabs) {
    if (viewLive(tab.view)) tab.view.setBounds(tabBounds);
  }

  raiseChrome(shellWin);
}

function raiseChrome(shellWin: ShellWindow): void {
  if (quitting || !windowLive(shellWin.win) || !viewLive(shellWin.chromeView)) return;
  try {
    shellWin.win.contentView.removeChildView(shellWin.chromeView);
    shellWin.win.contentView.addChildView(shellWin.chromeView);
  } catch {
    /* window is tearing down */
  }
}

function windowState(shellWin: ShellWindow): WindowState {
  const active = activeTab(shellWin);
  return {
    tabs: shellWin.tabs.map((tab) => toState(tab, tab.id === shellWin.activeId)),
    canGoBack: navigationFlag(active, "canGoBack"),
    canGoForward: navigationFlag(active, "canGoForward"),
  };
}

function navigationFlag(tab: Tab | undefined, method: "canGoBack" | "canGoForward"): boolean {
  if (!tab || !viewLive(tab.view)) return false;
  try {
    return tab.view.webContents.navigationHistory[method]();
  } catch {
    return false;
  }
}

function pushState(shellWin: ShellWindow): void {
  if (quitting || !windowLive(shellWin.win) || !viewLive(shellWin.chromeView)) return;
  try {
    shellWin.chromeView.webContents.send("tabs:state", windowState(shellWin));
  } catch {
    /* chrome view already gone */
  }
}

function viewLive(view: WebContentsView): boolean {
  try {
    return !view.webContents.isDestroyed();
  } catch {
    return false;
  }
}

function windowLive(win: BaseWindow): boolean {
  try {
    return !win.isDestroyed();
  } catch {
    return false;
  }
}

function toState(tab: Tab, active: boolean): TabState {
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favicon: tab.favicon,
    active,
    loading: tab.loading,
  };
}

function cleanTitle(title: string): string {
  return title.replace(/\s*[|–-]\s*Smartsheet.*$/i, "").trim();
}

function schedulePersist(): void {
  if (quitting) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistNow(), 400);
}

function snapshot(): AppSession {
  return {
    windows: [...shells.values()]
      .filter((shellWin) => windowLive(shellWin.win))
      .map((shellWin) => {
        const bounds = shellWin.win.getBounds();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: shellWin.win.isMaximized(),
          tabs: shellWin.tabs.map((tab) => ({ url: tab.url })),
          activeIndex: Math.max(
            0,
            shellWin.tabs.findIndex((t) => t.id === shellWin.activeId)
          ),
        };
      }),
  };
}

async function updateDockBadge(): Promise<void> {
  if (quitting || process.platform !== "darwin") return;
  let total = 0;
  for (const shellWin of shells.values()) {
    for (const tab of shellWin.tabs) {
      total += parseCount(tab.title);
    }
  }
  app.setBadgeCount(total);
}

function parseCount(title: string): number {
  const match = title.match(/\((\d+)\)/);
  return match ? Number(match[1]) : 0;
}

export function configureSession(): void {
  const ses = session.fromPartition(SESSION_PARTITION);
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "notifications" || permission === "clipboard-read" || permission === "clipboard-sanitized-write");
  });
  ses.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  );
}

export { shells };
