import { contextBridge, ipcRenderer } from "electron";
import type { WindowState } from "./types";

contextBridge.exposeInMainWorld("desktop", {
  onState: (callback: (state: WindowState) => void) => {
    ipcRenderer.on("tabs:state", (_event, state: WindowState) => callback(state));
  },
  getState: (): Promise<WindowState> => ipcRenderer.invoke("tabs:getState"),
  newTab: (url?: string) => ipcRenderer.send("tabs:new", url),
  closeTab: (id: string) => ipcRenderer.send("tabs:close", id),
  activateTab: (id: string) => ipcRenderer.send("tabs:activate", id),
  reorderTabs: (ids: string[]) => ipcRenderer.send("tabs:reorder", ids),
  goHome: () => ipcRenderer.send("tabs:home"),
  reload: () => ipcRenderer.send("tabs:reload"),
  goBack: () => ipcRenderer.send("tabs:back"),
  goForward: () => ipcRenderer.send("tabs:forward"),
  duplicateTab: (id: string) => ipcRenderer.send("tabs:duplicate", id),
  moveToNewWindow: (id: string) => ipcRenderer.send("tabs:move-new-window", id),
  openInBrowser: (id: string) => ipcRenderer.send("tabs:open-in-browser", id),
});
