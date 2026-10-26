import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claude, findClaude } from "./claude";

// Sets an agent up to talk to Rehearsal, for whichever client the designer
// uses, and reports what it did step by step.

export type Client = "claude-code" | "claude-desktop" | "cursor" | "other";
export type Method = "plugin" | "mcp";

export interface SetupStep {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ConnectPaths {
  repoRoot: string;
  stdioEntry: string;
  httpUrl: string;
  skillFile: string;
}

const DESKTOP_CONFIG = path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
const CURSOR_CONFIG = path.join(os.homedir(), ".cursor", "mcp.json");
const SKILL_TARGET = path.join(os.homedir(), ".claude", "skills", "rehearsal", "SKILL.md");

function mergeMcpConfig(file: string, entry: unknown): string {
  let data: { mcpServers?: Record<string, unknown> } = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // a missing or empty file starts fresh
  }
  data.mcpServers = { ...(data.mcpServers ?? {}), rehearsal: entry };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return file;
}

function copySkill(skillFile: string): SetupStep {
  try {
    fs.mkdirSync(path.dirname(SKILL_TARGET), { recursive: true });
    fs.copyFileSync(skillFile, SKILL_TARGET);
    return { label: "Skill installed", ok: true, detail: SKILL_TARGET };
  } catch (e) {
    return { label: "Skill installed", ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function setupClient(client: Client, method: Method, paths: ConnectPaths): Promise<SetupStep[]> {
  const steps: SetupStep[] = [];

  if (client === "claude-code") {
    if (!findClaude()) return [{ label: "Find Claude Code", ok: false, detail: "Claude Code is not installed on this Mac. Install it from claude.com/claude-code, then try again." }];
    if (method === "plugin") {
      const add = await claude(["plugin", "marketplace", "add", paths.repoRoot]);
      const already = /already|exists/i.test(add.out);
      steps.push({ label: "Marketplace added", ok: add.ok || already, detail: already ? "It was already there." : add.out });
      const install = await claude(["plugin", "install", "rehearsal@rehearsal", "--scope", "user"]);
      const installed = install.ok || /already/i.test(install.out);
      steps.push({ label: "Plugin installed", ok: installed, detail: install.out });
      const list = await claude(["plugin", "list"]);
      steps.push({ label: "Checked", ok: /rehearsal/i.test(list.out), detail: /rehearsal/i.test(list.out) ? "Claude Code lists the plugin." : list.out });
    } else {
      await claude(["mcp", "remove", "rehearsal", "-s", "user"]);
      const add = await claude(["mcp", "add", "--transport", "http", "-s", "user", "rehearsal", paths.httpUrl]);
      steps.push({ label: "MCP server added", ok: add.ok, detail: add.out });
      steps.push(copySkill(paths.skillFile));
      const list = await claude(["mcp", "list"]);
      steps.push({ label: "Checked", ok: /rehearsal/i.test(list.out), detail: /rehearsal/i.test(list.out) ? "Claude Code lists the server." : list.out });
    }
    return steps;
  }

  const entry = { command: "node", args: [paths.stdioEntry] };
  if (client === "claude-desktop") {
    try {
      const file = mergeMcpConfig(DESKTOP_CONFIG, entry);
      steps.push({ label: "Claude Desktop configured", ok: true, detail: `${file}. Quit and reopen Claude Desktop to pick it up.` });
    } catch (e) {
      steps.push({ label: "Claude Desktop configured", ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
    return steps;
  }
  if (client === "cursor") {
    try {
      const file = mergeMcpConfig(CURSOR_CONFIG, entry);
      steps.push({ label: "Cursor configured", ok: true, detail: `${file}. Cursor picks it up on its next start.` });
    } catch (e) {
      steps.push({ label: "Cursor configured", ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
    return steps;
  }
  return [{ label: "Other clients", ok: false, detail: "Paste the configuration shown into your client's MCP settings." }];
}

export async function connectStatus(): Promise<{ claudeFound: boolean; claudeCode: { plugin: boolean; mcp: boolean }; claudeDesktop: boolean; cursor: boolean; skill: boolean }> {
  const found = Boolean(findClaude());
  let plugin = false;
  let mcp = false;
  if (found) {
    const [plugins, servers] = await Promise.all([claude(["plugin", "list"]), claude(["mcp", "list"])]);
    plugin = /rehearsal/i.test(plugins.out);
    mcp = /^rehearsal:/im.test(servers.out) || /rehearsal/i.test(servers.out);
  }
  const has = (file: string) => {
    try {
      return /"rehearsal"/.test(fs.readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  };
  return { claudeFound: found, claudeCode: { plugin, mcp }, claudeDesktop: has(DESKTOP_CONFIG), cursor: has(CURSOR_CONFIG), skill: fs.existsSync(SKILL_TARGET) };
}
