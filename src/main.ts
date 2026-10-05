import { BaseWindow, Menu, app, shell } from "electron";
import {
  closeActiveTab,
  configureSession,
  createWindow,
  newTabInFocusedWindow,
  persistNow,
  registerIpc,
  reloadActiveTab,
  restoreWindows,
} from "./windows";
import { HOME_URL } from "./types";

const isMac = process.platform === "darwin";

app.setName("Smartsheet Desktop");

app.whenReady().then(() => {
  configureSession();
  registerIpc();
  buildMenu();
  restoreWindows();

  app.on("activate", () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  persistNow();
  if (!isMac) app.quit();
});

app.on("before-quit", () => {
  persistNow();
});

function buildMenu(): void {
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
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
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
