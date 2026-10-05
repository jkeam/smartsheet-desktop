import { BaseWindow, Menu, app, nativeImage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  activateLastTab,
  activateTabByIndex,
  closeActiveTab,
  configureSession,
  createWindow,
  findNextInFocusedWindow,
  findPrevInFocusedWindow,
  newTabInFocusedWindow,
  openFindInFocusedWindow,
  persistNow,
  prepareQuit,
  registerIpc,
  reloadActiveTab,
  reopenClosedTab,
  restoreWindows,
} from "./windows";
import { HOME_URL } from "./types";

const isMac = process.platform === "darwin";

app.setName("Smartsheet Desktop");

app.whenReady().then(() => {
  applyDevAppIcon();
  configureSession();
  registerIpc();
  buildMenu();
  restoreWindows();

  app.on("activate", () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow();
  });
});

/** Packaged macOS builds get the Dock/About icon from electron-builder; npm start does not. */
function applyDevAppIcon(): void {
  if (app.isPackaged) return;
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  if (!fs.existsSync(iconPath)) return;
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return;
  if (isMac && app.dock) app.dock.setIcon(image);
  app.setAboutPanelOptions({ iconPath });
}

app.on("window-all-closed", () => {
  persistNow();
  if (!isMac) app.quit();
});

app.on("before-quit", () => {
  prepareQuit();
});

function buildMenu(): void {
  const tabJumpItems: Electron.MenuItemConstructorOptions[] = [1, 2, 3, 4, 5, 6, 7, 8].map(
    (n) => ({
      label: `Tab ${n}`,
      accelerator: `CmdOrCtrl+${n}`,
      click: () => activateTabByIndex(n - 1),
    })
  );

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: () => newTabInFocusedWindow(),
        },
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createWindow(),
        },
        {
          label: "Reopen Closed Tab",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => reopenClosedTab(),
        },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => closeActiveTab(),
        },
        { type: "separator" },
        {
          label: "Open Home",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => newTabInFocusedWindow(HOME_URL),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => openFindInFocusedWindow(),
        },
        {
          label: "Find Next",
          accelerator: "CmdOrCtrl+G",
          click: () => findNextInFocusedWindow(),
        },
        {
          label: "Find Previous",
          accelerator: "CmdOrCtrl+Shift+G",
          click: () => findPrevInFocusedWindow(),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => reloadActiveTab(),
        },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        ...tabJumpItems,
        {
          label: "Last Tab",
          accelerator: "CmdOrCtrl+9",
          click: () => activateLastTab(),
        },
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Smartsheet Web App",
          click: () => void shell.openExternal(HOME_URL),
        },
        {
          label: "This is an unofficial wrapper",
          enabled: false,
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
