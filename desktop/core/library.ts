import fs from "node:fs";
import path from "node:path";
import { readText } from "./fs";

// Reads a design library out of a repository on disk: its written rules,
// its tokens and a map of its components. Agents get this before they
// generate any UI so the result uses the real design system.

export interface DesignLibrary {
  path: string;
  rules: { file: string; content: string }[];
  tokens: { file: string; content: string }[];
  components: { name: string; file: string }[];
  note?: string;
}

const RULE_FILES = ["DESIGN.md", "design.md", "AGENTS.md", "CLAUDE.md", "README.md", "docs/design-system.md", "docs/tokens.md"];
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "coverage", "storybook-static"]);
const MAX_RULE = 24_000;
const MAX_TOKEN = 16_000;

function walk(root: string, depth: number, onFile: (file: string, rel: string) => void) {
  const stack: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth: d } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (d < depth) stack.push({ dir: full, depth: d + 1 });
      } else {
        onFile(full, path.relative(root, full));
      }
    }
  }
}

export function readDesignLibrary(repoPath: string): DesignLibrary {
  const lib: DesignLibrary = { path: repoPath, rules: [], tokens: [], components: [] };
  if (!fs.existsSync(repoPath)) {
    lib.note = "The design library path does not exist on this machine.";
    return lib;
  }
  for (const rel of RULE_FILES) {
    const content = readText(path.join(repoPath, rel));
    if (content) lib.rules.push({ file: rel, content: content.slice(0, MAX_RULE) });
  }
  walk(repoPath, 6, (full, rel) => {
    const base = path.basename(full).toLowerCase();
    const isToken =
      /tokens?\.(json|css|ts|js)$/.test(base) || /\.tokens\.json$/.test(base) || base === "theme.css" || base === "globals.css" || base === "variables.css";
    if (isToken && lib.tokens.length < 8) {
      const content = readText(full);
      if (content && (!base.endsWith(".css") || content.includes("--"))) lib.tokens.push({ file: rel, content: content.slice(0, MAX_TOKEN) });
      return;
    }
    const inComponents = /(^|\/)(components|ui|primitives|elements)\//.test(rel) || /(^|\/)src\/components\//.test(rel);
    if (inComponents && /\.(tsx|jsx|vue|svelte|html)$/.test(base) && !/\.(test|spec|stories)\./.test(base) && base !== "index.tsx") {
      if (lib.components.length < 300) lib.components.push({ name: path.basename(base, path.extname(base)), file: rel });
    }
  });
  lib.components.sort((a, b) => a.name.localeCompare(b.name));
  if (!lib.rules.length && !lib.tokens.length && !lib.components.length) {
    lib.note = "No rules, tokens or components were recognised in this repository.";
  }
  return lib;
}
