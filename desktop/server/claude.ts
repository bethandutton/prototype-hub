import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Finding and running the Claude Code CLI on this Mac. The app may be
// launched from the Dock with a bare PATH, so the usual places are checked.

export function findClaude(): string | null {
  const home = os.homedir();
  const candidates = [
    process.env.REHEARSAL_CLAUDE,
    path.join(home, ".local", "bin", "claude"),
    path.join(home, ".claude", "local", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    ...(process.env.PATH ?? "").split(":").map((d) => path.join(d, "claude")),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      // keep looking
    }
  }
  return null;
}

export function envForClaude(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const extra = [path.join(home, ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  return { ...process.env, PATH: [...extra, process.env.PATH ?? ""].join(":") };
}

export function claude(args: string[], opts: { cwd?: string } = {}): Promise<{ ok: boolean; out: string }> {
  const bin = findClaude();
  if (!bin) return Promise.resolve({ ok: false, out: "Claude Code is not installed on this Mac. Install it from claude.com/claude-code, then try again." });
  return new Promise((resolve) => {
    execFile(bin, args, { cwd: opts.cwd ?? os.homedir(), env: envForClaude(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = `${stdout ?? ""}${stderr ?? ""}`.trim();
      resolve({ ok: !err, out: out || (err ? err.message : "") });
    });
  });
}

export function spawnClaude(args: string[], opts: { cwd?: string } = {}): ChildProcess | null {
  const bin = findClaude();
  if (!bin) return null;
  return spawn(bin, args, { cwd: opts.cwd ?? os.homedir(), env: envForClaude(), stdio: ["ignore", "pipe", "pipe"] });
}
