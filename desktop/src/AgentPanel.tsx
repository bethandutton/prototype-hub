import { useEffect, useRef, useState } from "react";
import type { PrototypeData } from "./api";
import { Icon, initials } from "./ui";
import type { SelectedBlock } from "./Viewer";

type Line = { id: number; role: "me" | "agent" | "tool" | "note"; text: string };

const TOOL_LABELS: Record<string, string> = {
  get_prototype: "Read the prototype",
  list_prototypes: "Looked at the prototypes",
  list_workspaces: "Looked at the workspaces",
  get_design_library: "Loaded the design library",
  propose_block_version: "Proposed an alternative",
  update_prototype: "Updated the page",
  create_prototype: "Created a prototype",
  add_comment: "Left a comment",
  list_comments: "Read the comments",
  resolve_comment: "Resolved a comment",
  assign: "Assigned someone",
  get_insights: "Read the decisions",
  read_file: "Read a file",
  whoami: "Checked who you are",
  list_people: "Looked up people",
};

// A chat with the designer's own Claude Code, on the right of the stage.
// The agent has the Rehearsal tools and knows which prototype and block
// are on screen.
export function AgentPanel({ data, me, selected, onClose }: { data: PrototypeData; me: string; selected: SelectedBlock | null; onClose: () => void }) {
  const key = `rehearsal.agent.${data.prototype.id}`;
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${key}.lines`) ?? "[]");
    } catch {
      return [];
    }
  });
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(key));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const counter = useRef(Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(`${key}.lines`, JSON.stringify(lines.slice(-200)));
      if (sessionId) localStorage.setItem(key, sessionId);
      else localStorage.removeItem(key);
    } catch {
      // storage is a convenience only
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines, sessionId, key]);

  const push = (role: Line["role"], text: string) => {
    const id = ++counter.current;
    setLines((l) => [...l, { id, role, text }]);
    return id;
  };
  const append = (id: number, text: string) => setLines((l) => l.map((x) => (x.id === id ? { ...x, text: x.text + text } : x)));

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    push("me", message);
    setBusy(true);
    const agentId = push("agent", "");
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prototypeId: data.prototype.id, blockId: selected?.id ?? null, message, sessionId }),
        signal: abort.current.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "session" && ev.sessionId) setSessionId(ev.sessionId);
          if (ev.type === "text") append(agentId, ev.text);
          if (ev.type === "tool" && typeof ev.name === "string" && ev.name.startsWith("mcp__rehearsal__")) {
            const short = ev.name.replace(/^mcp__rehearsal__/, "");
            push("tool", TOOL_LABELS[short] ?? short.replace(/_/g, " "));
          }
          if (ev.type === "error") push("note", ev.detail);
          if (ev.type === "done" && ev.detail) push("note", ev.detail);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") push("note", (e as Error).message);
    } finally {
      setBusy(false);
      setLines((l) => l.filter((x) => !(x.id === agentId && x.text === "")));
    }
  };

  return (
    <aside className="panel agent-panel">
      <div className="panel-head">
        <h3 className="row">
          <span className="status-dot on" />
          Claude
        </h3>
        <div className="row">
          <button
            className="btn small quiet"
            onClick={() => {
              abort.current?.abort();
              setSessionId(null);
              setLines([]);
            }}
          >
            New chat
          </button>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <div className="panel-body agent-lines">
        {lines.length === 0 && (
          <p className="muted small" style={{ padding: "12px 0" }}>
            Ask for a change to this prototype{selected ? `, or to the selected ${selected.tag}` : ""}. Claude will ask you why in one line, then propose it as an alternative you can pick.
          </p>
        )}
        {lines.map((l) =>
          l.role === "me" ? (
            <div key={l.id} className="agent-line me">
              <span className="avatar">{initials(me)}</span>
              <div className="bubble">{l.text}</div>
            </div>
          ) : l.role === "agent" ? (
            <div key={l.id} className="agent-line">
              <span className="avatar claude">C</span>
              <div className="bubble agent">{l.text || <span className="typing" />}</div>
            </div>
          ) : (
            <div key={l.id} className={`agent-${l.role}`}>
              {l.role === "tool" && <Icon name="check" size={11} />}
              {l.text}
            </div>
          ),
        )}
        {busy && lines[lines.length - 1]?.role !== "agent" && (
          <div className="agent-line">
            <span className="avatar claude">C</span>
            <div className="bubble agent">
              <span className="typing" />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form
        className="agent-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {selected && (
          <div className="agent-context truncate">
            <Icon name="chevron-right" size={11} /> {selected.label}
          </div>
        )}
        <textarea
          className="textarea"
          rows={2}
          placeholder={busy ? "Claude is working…" : "Ask for a change"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="hint">Enter to send · Shift+Enter for a new line</span>
          {busy ? (
            <button type="button" className="btn small" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <button className="btn small primary" disabled={!draft.trim()}>
              Send
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}
