"use client";

import { useActionState, useState, useTransition } from "react";
import { createAgentToken, revokeAgentToken, type TokenResult } from "@/lib/actions";

export function AgentTokenForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action, pending] = useActionState<TokenResult, FormData>(createAgentToken, {});

  if (state.token) return <TokenReveal token={state.token} name={state.name ?? ""} mcpUrl={mcpUrl} />;

  return (
    <form action={action} className="flex flex-col gap-5">
      <h2 className="font-sans text-lg">New token</h2>
      <label className="flex flex-col gap-1.5 text-sm">
        What will use it
        <input
          name="name"
          placeholder="Claude Code on my laptop"
          className="rounded-md border border-hairline px-3 py-2 text-base"
        />
      </label>
      {state.error && <p className="text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "Creating…" : "Create token"}
      </button>
    </form>
  );
}

function TokenReveal({ token, name, mcpUrl }: { token: string; name: string; mcpUrl: string }) {
  const claude = `claude mcp add --transport http rehearsal ${mcpUrl} --header "Authorization: Bearer ${token}"`;
  const json = JSON.stringify(
    { mcpServers: { rehearsal: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-sans text-lg">Token for {name}</h2>
        <p className="mt-1 text-sm text-muted">
          Shown once. Paste it into your agent now; if you lose it, create another.
        </p>
      </div>

      <Snippet label="Token" value={token} />
      <Snippet label="Claude Code: run this in a terminal" value={claude} />
      <Snippet label="Cursor, Windsurf and others: add to the MCP settings" value={json} />

      <a href="/connect" className="self-start text-sm underline underline-offset-4">
        Done
      </a>
    </div>
  );
}

function Snippet({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-baseline justify-between">
        {label}
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs text-muted underline-offset-4 hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
      <pre className="overflow-x-auto rounded-md bg-stage px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {value}
      </pre>
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
