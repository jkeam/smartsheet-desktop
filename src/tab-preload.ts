import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopTab", {
  openExternal: (url: string) => ipcRenderer.send("tab:open-external", url),
});
