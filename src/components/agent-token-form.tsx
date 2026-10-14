"use client";

import { useActionState, useState, useTransition } from "react";
import { createAgentToken, revokeAgentToken, type TokenResult } from "@/lib/actions";

export function AgentTokenForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action, pending] = useActionState<TokenResult, FormData>(createAgentToken, {});

  if (state.token) return <TokenReveal token={state.token} name={state.name ?? ""} mcpUrl={mcpUrl} />;

  return (
    <form action={action} className="flex max-w-[440px] flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Call this agent
        <input
          name="name"
          placeholder="Claude Code on my laptop"
          className="rounded-md border border-hairline px-3 py-2.5 text-base text-ink"
        />
      </label>
      {state.error && <p className="text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-md bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "One moment…" : "Connect an agent"}
      </button>
    </form>
  );
}

function TokenReveal({ token, name, mcpUrl }: { token: string; name: string; mcpUrl: string }) {
  const prompt = `Connect to Rehearsal, the prototype review tool, as an MCP server.

Name: rehearsal
Transport: HTTP (streamable)
URL: ${mcpUrl}
Header: Authorization: Bearer ${token}

If you are Claude Code, run:
claude mcp add --transport http rehearsal ${mcpUrl} --header "Authorization: Bearer ${token}"

If you are Cursor, Windsurf or another agent, add this to your MCP settings:
{"mcpServers":{"rehearsal":{"url":"${mcpUrl}","headers":{"Authorization":"Bearer ${token}"}}}}

Then call the list_projects tool to confirm it works and tell me what you found.`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-sans text-lg">Now hand this to {name}</h2>
        <p className="mt-1 text-sm text-muted">
          Copy it and paste it into your agent as a message. It will connect itself, then this page will show it
          as connected.
        </p>
      </div>

      <Snippet label="Paste this into your agent" value={prompt} prominent />

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Prefer to set it up by hand?</summary>
        <div className="mt-4 flex flex-col gap-5">
          <Snippet label="Token" value={token} />
          <Snippet
            label="Claude Code: run this in a terminal"
            value={`claude mcp add --transport http rehearsal ${mcpUrl} --header "Authorization: Bearer ${token}"`}
          />
          <Snippet
            label="Cursor, Windsurf and others: add to the MCP settings"
            value={JSON.stringify(
              { mcpServers: { rehearsal: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } },
              null,
              2,
            )}
          />
        </div>
      </details>

      <p className="text-sm text-muted">The token is shown once. If you lose it, create another.</p>

      <a href="/connect" className="self-start text-sm underline underline-offset-4">
        Done
      </a>
    </div>
  );
}

function Snippet({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-baseline justify-between">
        {label}
        {!prominent && (
          <button type="button" onClick={copy} className="text-xs text-muted underline-offset-4 hover:underline">
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </span>
      <pre className="overflow-x-auto rounded-md bg-stage px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {value}
      </pre>
      {prominent && (
        <button
          type="button"
          onClick={copy}
          className="mt-2 self-start rounded-md bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-80"
        >
          {copied ? "Copied" : "Copy for your agent"}
        </button>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => revokeAgentToken(id))}
      className="text-sm text-muted underline-offset-4 hover:underline disabled:opacity-40"
    >
      Revoke
    </button>
  );
}
