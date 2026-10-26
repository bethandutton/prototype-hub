import { contextBridge, ipcRenderer } from "electron";

// What the renderer may ask the Mac shell for. In a plain browser none of
// this exists and the app falls back to typing a path.
contextBridge.exposeInMainWorld("rehearsal", {
  isDesktop: true,
  pickFolder: (title: string): Promise<string | null> => ipcRenderer.invoke("pick-folder", title),
  reveal: (target: string): Promise<void> => ipcRenderer.invoke("reveal", target),
});
