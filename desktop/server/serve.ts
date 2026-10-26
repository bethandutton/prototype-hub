import path from "node:path";
import { Store } from "../core/store";
import { startAppServer } from "./app";

// Runs the app in an ordinary browser, without Electron. Handy while
// developing; the Mac app starts the same server itself.
const root = path.resolve(__dirname, "..");
startAppServer({
  store: new Store(),
  uiDir: path.join(root, "dist"),
  publicDir: path.join(root, "public"),
  skillFile: path.join(root, "plugin", "skills", "rehearsal", "SKILL.md"),
  stdioEntry: path.join(root, "out", "stdio.cjs"),
  repoRoot: path.resolve(root, ".."),
  port: Number(process.env.PORT) || undefined,
}).then((s) => {
  console.log(`Rehearsal is at ${s.url} (MCP at ${s.url}/mcp)`);
});
