// Renders the logo mark to a 1024px PNG for the app icon, using Electron
// itself so no extra image tooling is needed.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "public", "logo-mark.svg"), "utf8");
// macOS icons sit inside a margin; the mark fills about 82% of the square.
const html = `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 18px 30px rgba(0,0,0,.18))">${svg.replace('width="64" height="64"', 'width="840" height="840"')}</div></body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(root, "build", "icon.png"), image.toPNG());
  console.log("Wrote build/icon.png", image.getSize());
  app.quit();
});
