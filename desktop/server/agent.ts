import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { ChildProcess } from "node:child_process";
import { findClaude, spawnClaude } from "./claude";

// Chat with the designer's own Claude Code from inside the app. Each
// message runs the CLI in print mode, resumed on the same session, with the
// Rehearsal MCP attached and the skill's rules as the system prompt.

export interface AgentEvent {
  type: "session" | "text" | "tool" | "status" | "done" | "error";
  sessionId?: string;
  text?: string;
  name?: string;
  input?: unknown;
  detail?: string;
}

export interface AgentRun {
  process: ChildProcess;
}

export function runAgent(opts: {
  home: string;
  httpUrl: string;
  prompt: string;
  sessionId: string | null;
  systemPrompt: string;
  onEvent: (e: AgentEvent) => void;
}): AgentRun | null {
  if (!findClaude()) {
    opts.onEvent({ type: "error", detail: "Claude Code is not installed on this Mac. Install it from claude.com/claude-code, then try again." });
    return null;
  }
  const mcpFile = path.join(opts.home, "agent-mcp.json");
  fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: { rehearsal: { type: "http", url: opts.httpUrl } } }));
  const args = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--strict-mcp-config",
    "--mcp-config",
    mcpFile,
    "--allowedTools",
    "mcp__rehearsal",
    "--append-system-prompt",
    opts.systemPrompt,
  ];
  if (opts.sessionId) args.push("--resume", opts.sessionId);
  const child = spawnClaude(args, { cwd: opts.home });
  if (!child) return null;

  const lines = readline.createInterface({ input: child.stdout! });
  let stderr = "";
  child.stderr?.on("data", (d) => (stderr += d.toString()));
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const type = msg.type as string;
    if (type === "system" && msg.subtype === "init" && typeof msg.session_id === "string") {
      opts.onEvent({ type: "session", sessionId: msg.session_id });
    } else if (type === "stream_event") {
      const ev = msg.event as { type: string; delta?: { type: string; text?: string } } | undefined;
      if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) opts.onEvent({ type: "text", text: ev.delta.text });
    } else if (type === "assistant") {
      const content = (msg.message as { content?: { type: string; name?: string; input?: unknown }[] })?.content ?? [];
      for (const block of content) if (block.type === "tool_use") opts.onEvent({ type: "tool", name: block.name, input: block.input });
    } else if (type === "result") {
      const ok = msg.subtype === "success";
      opts.onEvent({ type: "done", sessionId: msg.session_id as string, detail: ok ? "" : String(msg.result ?? msg.subtype ?? "") });
    }
  });
  child.on("close", (code) => {
    if (code && code !== 0) opts.onEvent({ type: "error", detail: stderr.trim() || `Claude Code exited with code ${code}.` });
    opts.onEvent({ type: "done" });
  });
  child.on("error", (err) => opts.onEvent({ type: "error", detail: err.message }));
  return { process: child };
}
