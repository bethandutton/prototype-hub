"use client";

import { useActionState } from "react";
import { connectGithub, type ActionResult } from "@/lib/actions";

// GitHub's "new token" page can be pre-filled, so the person only has to
// press Generate and copy.
const tokenUrl = "https://github.com/settings/tokens/new?description=Rehearsal&scopes=repo";

export function ConnectGithub() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(connectGithub, {});

  return (
    <form action={action} className="flex max-w-[480px] flex-col gap-5">
      <ol className="flex flex-col gap-3 text-sm">
        <li className="flex gap-3">
          <span className="w-4 shrink-0 text-muted">1</span>
          <span>
            <a href={tokenUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Open GitHub&rsquo;s new token page
            </a>
            . It&rsquo;s already filled in; scroll down and press <strong>Generate token</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-4 shrink-0 text-muted">2</span>
          <span>Copy the token GitHub shows you (it starts with ghp_).</span>
        </li>
        <li className="flex gap-3">
          <span className="w-4 shrink-0 text-muted">3</span>
          <span className="flex flex-1 flex-col gap-2">
            Paste it here.
            <input
              name="token"
              type="password"
              autoComplete="off"
              required
              placeholder="ghp_…"
              className="rounded-md border border-hairline px-3 py-2.5 font-mono text-sm"
            />
          </span>
        </li>
      </ol>
      {state.error && <p className="text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "Checking…" : "Connect GitHub"}
      </button>
      <p className="text-xs text-muted">
        Stored encrypted and shared with your team. Rehearsal uses it to create private repositories for your
        projects and to save versions. Already have your agent connected? You can ask it instead:
        &ldquo;Connect my GitHub to Rehearsal.&rdquo;
      </p>
    </form>
  );
}
