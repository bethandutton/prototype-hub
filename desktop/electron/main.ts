import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { Store } from "../core/store";
import { startAppServer, type AppServer } from "../server/app";

// The Mac shell: starts the local server and opens a window on it.

let server: AppServer | null = null;

const root = path.resolve(__dirname, "..");

async function boot() {
  server = await startAppServer({
    store: new Store(),
    uiDir: path.join(root, "dist"),
    publicDir: path.join(root, "public"),
    skillFile: path.join(root, "plugin", "skills", "rehearsal", "SKILL.md"),
    stdioEntry: path.join(root, "out", "stdio.cjs"),
    repoRoot: path.resolve(root, ".."),
  });

  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: "#ffffff",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  await win.loadURL(server.url);
}

ipcMain.handle("pick-folder", async (_e, title: string) => {
  const result = await dialog.showOpenDialog({ title, properties: ["openDirectory", "createDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("reveal", async (_e, target: string) => {
  shell.showItemInFolder(target);
});

app.whenReady().then(boot);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => void server?.close());
