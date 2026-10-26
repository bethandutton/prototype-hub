// Drives the app in an offscreen Electron window and saves screenshots, so
// the viewer can be checked without a person at the screen.
// Usage: electron scripts/snap.cjs <scenario.json> <outDir>
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { startAppServer, Store } = require("../out/lib.cjs");

const [scenarioFile, outDir] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(scenarioFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Clicks an element inside the prototype frame by dispatching a mouse event
// at its centre, which is what the helper listens for.
const clickInFrame = (selector) => `
  (function(){ var el = document.querySelector(${JSON.stringify(selector)}); if (!el) return "missing";
    var r = el.getBoundingClientRect(); var x = r.left + r.width/2, y = r.top + r.height/2;
    document.dispatchEvent(new MouseEvent("mousemove", {clientX:x, clientY:y, bubbles:true}));
    el.dispatchEvent(new MouseEvent("click", {clientX:x, clientY:y, bubbles:true, cancelable:true}));
    return "clicked"; })()`;

app.whenReady().then(async () => {
  const server = await startAppServer({
    store: new Store(),
    uiDir: path.join(root, "dist"),
    publicDir: path.join(root, "public"),
    skillFile: path.join(root, "plugin", "skills", "rehearsal", "SKILL.md"),
    stdioEntry: path.join(root, "out", "stdio.cjs"),
    repoRoot: path.resolve(root, ".."),
    port: 0,
  });
  const win = new BrowserWindow({ width: 1360, height: 880, show: false, webPreferences: { offscreen: true, preload: path.join(root, "out", "preload.cjs"), contextIsolation: true, sandbox: true } });
  win.webContents.setFrameRate(10);
  const log = [];
  win.webContents.on("console-message", (e) => { if (e.level >= 2) log.push(`[console] ${e.message}`); });
  for (const step of steps) {
    try {
      if (step.goto) await win.loadURL(server.url + step.goto);
      if (step.wait) await sleep(step.wait);
      if (step.js) log.push(`[js] ${JSON.stringify(await win.webContents.executeJavaScript(step.js))}`);
      if (step.click) await win.webContents.executeJavaScript(`(function(){var el=[...document.querySelectorAll(${JSON.stringify(step.click)})].find(e=>!${JSON.stringify(step.text || "")}||e.textContent.trim().includes(${JSON.stringify(step.text || "")}));if(!el)return "missing: "+${JSON.stringify(step.click)};el.click();return "clicked"})()`).then((r) => log.push(`[click ${step.click}] ${r}`));
      if (step.frameJs) {
        const frame = win.webContents.mainFrame.frames[0];
        log.push(`[frameJs] ${frame ? JSON.stringify(await frame.executeJavaScript(step.frameJs)) : "no frame"}`);
      }
      if (step.frameClick) {
        const frame = win.webContents.mainFrame.frames[0];
        log.push(`[frameClick ${step.frameClick}] ${frame ? await frame.executeJavaScript(clickInFrame(step.frameClick)) : "no frame"}`);
      }
      if (step.type) await win.webContents.executeJavaScript(`(function(){var el=document.querySelector(${JSON.stringify(step.type)});if(!el)return "missing";var setter=Object.getOwnPropertyDescriptor(el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set;setter.call(el,${JSON.stringify(step.value)});el.dispatchEvent(new Event("input",{bubbles:true}));return "typed"})()`).then((r) => log.push(`[type] ${r}`));
      if (step.key === "Escape") { win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" }); }
      if (step.shot) {
        await sleep(300);
        const image = await win.webContents.capturePage();
        fs.writeFileSync(path.join(outDir, step.shot), image.toPNG());
        log.push(`[shot] ${step.shot}`);
      }
    } catch (e) {
      log.push(`[error] ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(outDir, "log.txt"), log.join("\n") + "\n");
  console.log(log.join("\n"));
  await server.close();
  app.quit();
});
