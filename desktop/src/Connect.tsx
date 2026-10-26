import { useEffect, useState } from "react";
import { api, type Connection, type ConnectStatus, type SetupStep } from "./api";
import { Code, Icon } from "./ui";

type Client = "claude-code" | "claude-desktop" | "cursor" | "other";
type Method = "plugin" | "mcp";

const CLIENTS: { id: Client; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "other", label: "Something else" },
];

export function Connect() {
  const [conn, setConn] = useState<Connection | null>(null);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [client, setClient] = useState<Client>("claude-code");
  const [method, setMethod] = useState<Method>("plugin");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<SetupStep[] | null>(null);

  const refresh = () => api.connectStatus().then(setStatus).catch(() => setStatus(null));
  useEffect(() => {
    api.connection().then(setConn);
    void refresh();
  }, []);
  if (!conn) return null;

  const connected =
    client === "claude-code" ? (method === "plugin" ? status?.claudeCode.plugin : status?.claudeCode.mcp) : client === "claude-desktop" ? status?.claudeDesktop : client === "cursor" ? status?.cursor : false;

  const run = () => {
    setBusy(true);
    setSteps(null);
    api
      .connectSetup(client, method)
      .then((s) => {
        setSteps(s);
        return refresh();
      })
      .finally(() => setBusy(false));
  };

  const manual = (() => {
    if (client === "claude-code" && method === "plugin")
      return [
        { text: "Add this repository as a marketplace, then install the plugin. The plugin carries the MCP server and the skill.", code: `claude plugin marketplace add ${conn.repoRoot}\nclaude plugin install rehearsal@rehearsal --scope user` },
      ];
    if (client === "claude-code")
      return [
        { text: "Add the server while Rehearsal is open:", code: conn.claude.http },
        { text: "Then give Claude Code the skill:", code: conn.skillInstall },
      ];
    if (client === "claude-desktop") return [{ text: "Add this to ~/Library/Application Support/Claude/claude_desktop_config.json, then quit and reopen Claude Desktop:", code: JSON.stringify(conn.json, null, 2) }];
    if (client === "cursor") return [{ text: "Add this to ~/.cursor/mcp.json:", code: JSON.stringify(conn.json, null, 2) }];
    return [
      { text: "Most MCP clients take this configuration:", code: JSON.stringify(conn.json, null, 2) },
      { text: "Or connect over HTTP while Rehearsal is open:", code: conn.httpUrl },
    ];
  })();

  return (
    <div className="page">
      <div className="centre" style={{ margin: "0 auto", maxWidth: 640 }}>
        <h1>Connect your agent</h1>
        <p className="lead">Pick what you use. Rehearsal sets it up, or shows you exactly what to paste. Nothing leaves your Mac.</p>

        <div className="seg">
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              className={client === c.id ? "on" : ""}
              onClick={() => {
                setClient(c.id);
                setSteps(null);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {client === "claude-code" && (
          <div className="row" style={{ margin: "14px 0 4px" }}>
            <span className="muted small">Install as</span>
            <div className="seg small">
              <button className={method === "plugin" ? "on" : ""} onClick={() => setMethod("plugin")}>
                Plugin
              </button>
              <button className={method === "mcp" ? "on" : ""} onClick={() => setMethod("mcp")}>
                MCP server
              </button>
            </div>
            <span className="hint">{method === "plugin" ? "One install, skill included. Recommended." : "Just the server; the skill is copied alongside."}</span>
          </div>
        )}

        <div className="connect-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <span className={`status-dot ${connected ? "on" : ""}`} />
              <span>{connected ? "Connected" : status && client === "claude-code" && !status.claudeFound ? "Claude Code is not installed on this Mac" : "Not connected yet"}</span>
            </div>
            {client !== "other" && (
              <button className="btn primary" disabled={busy} onClick={run}>
                {busy ? "Setting up…" : connected ? "Set it up again" : "Set it up for me"}
              </button>
            )}
          </div>
          {steps && (
            <ul className="setup-steps">
              {steps.map((s, i) => (
                <li key={i} className={s.ok ? "ok" : "bad"}>
                  <Icon name={s.ok ? "check" : "close"} size={13} />
                  <span>
                    <strong>{s.label}</strong>
                    {s.detail && <span className="muted"> · {s.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="manual">
          <summary>Or do it by hand</summary>
          {manual.map((m, i) => (
            <div key={i}>
              <p className="muted">{m.text}</p>
              <Code>{m.code}</Code>
            </div>
          ))}
        </details>

        <p className="muted small" style={{ marginTop: 24 }}>
          Whatever you use, the agent gets the same tools: read prototypes, propose alternatives with reasons, comment, assign and resolve. The skill makes it ask you why before each change.
        </p>
      </div>
    </div>
  );
}
