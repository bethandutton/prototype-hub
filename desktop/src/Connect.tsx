import { useEffect, useState } from "react";
import { api, type Connection } from "./api";
import { Code } from "./ui";

export function Connect() {
  const [conn, setConn] = useState<Connection | null>(null);
  useEffect(() => {
    api.connection().then(setConn);
  }, []);
  if (!conn) return null;
  const skillInstall = `mkdir -p ~/.claude/skills/rehearsal && cp "${conn.skillFile}" ~/.claude/skills/rehearsal/SKILL.md`;
  return (
    <div className="page">
      <div className="centre" style={{ margin: "0 auto", maxWidth: 640 }}>
        <h1>Connect your agent</h1>
        <p className="lead">
          Rehearsal runs an MCP server on this Mac. Any agent that speaks MCP can read your prototypes, propose versions with reasons and leave comments. Nothing leaves your machine.
        </p>

        <ol className="steps">
          <li>
            <h3>Add the server to Claude Code</h3>
            <p className="muted">While Rehearsal is open, connect over HTTP. Paste this in a terminal once:</p>
            <Code>{conn.claude.http}</Code>
            <p className="muted">Or let the agent start the server itself, so it works even when the app is closed:</p>
            <Code>{conn.claude.stdio}</Code>
          </li>
          <li>
            <h3>Give it the skill</h3>
            <p className="muted">The skill tells the agent to load the design library first, keep block ids, ask why before every change and save the answer with the version.</p>
            <Code>{skillInstall}</Code>
          </li>
          <li>
            <h3>Other clients</h3>
            <p className="muted">Claude Desktop, Cursor and most MCP clients take this configuration:</p>
            <Code>{JSON.stringify(conn.json, null, 2)}</Code>
          </li>
        </ol>

        <p className="muted small">
          The HTTP endpoint is {conn.httpUrl}. Agents over stdio read and write the same workspace folders as the app, so changes show up here live.
        </p>
      </div>
    </div>
  );
}
