import { build } from "esbuild";

// Bundles everything that runs in Node: the Electron main process, its
// preload, the stdio MCP entry for agents, and a standalone server for
// running the app in an ordinary browser while developing.
const common = { bundle: true, platform: "node", format: "cjs", target: "node22", sourcemap: true, logLevel: "info" };

await Promise.all([
  build({ ...common, entryPoints: ["electron/main.ts"], outfile: "out/main.cjs", external: ["electron"] }),
  build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "out/preload.cjs", external: ["electron"] }),
  build({ ...common, entryPoints: ["server/stdio.ts"], outfile: "out/stdio.cjs" }),
  // The same stdio entry inside the plugin folder, where Claude Code's plugin loader expects it.
  build({ ...common, entryPoints: ["server/stdio.ts"], outfile: "plugin/server/stdio.cjs", sourcemap: false }),
  build({ ...common, entryPoints: ["server/serve.ts"], outfile: "out/serve.cjs" }),
  build({ ...common, entryPoints: ["server/lib.ts"], outfile: "out/lib.cjs" }),
]);
