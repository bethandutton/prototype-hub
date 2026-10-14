"use client";

import { useActionState, useState } from "react";
import { connectGithub, createProject, type ActionResult } from "@/lib/actions";

type Storage = "github" | "google-drive" | "rehearsal-cloud";

const storages: { id: Storage; name: string; blurb: string; soon?: string }[] = [
  {
    id: "github",
    name: "GitHub",
    blurb: "A repository your team owns. Agents already know how to work in one, and every change is kept.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    blurb: "A shared folder that syncs to everyone's machine.",
    soon: "Coming soon",
  },
  {
    id: "rehearsal-cloud",
    name: "Rehearsal Cloud",
    blurb: "We keep the files for you. Nothing to connect.",
    soon: "Coming soon, paid plan",
  },
];

export function NewProjectForm({ githubLogin }: { githubLogin: string | null }) {
  const [storage, setStorage] = useState<Storage>("github");

  return (
    <div className="mt-14 grid gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <fieldset>
        <legend className="text-lg">Where the files live</legend>
        <ul className="mt-5 border-t border-hairline">
          {storages.map((s) => {
            const disabled = Boolean(s.soon);
            return (
              <li key={s.id} className="border-b border-hairline">
                <label
                  className={`flex cursor-pointer items-start gap-4 py-5 ${disabled ? "cursor-default text-faint" : ""}`}
                >
                  <input
                    type="radio"
                    name="storage"
                    value={s.id}
                    checked={storage === s.id}
                    disabled={disabled}
                    onChange={() => setStorage(s.id)}
                    className="mt-1.5 accent-black"
                  />
                  <span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-base">{s.name}</span>
                      {s.soon && <span className="text-xs text-faint">{s.soon}</span>}
                    </span>
                    <span className={`mt-1 block text-sm ${disabled ? "" : "text-muted"}`}>{s.blurb}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {storage === "github" && (githubLogin ? <CreateForm login={githubLogin} /> : <ConnectGithub />)}
    </div>
  );
}

function ConnectGithub() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(connectGithub, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg">Connect GitHub</h2>
        <p className="mt-1 text-sm text-muted">
          Create a{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            fine-grained token
          </a>{" "}
          with read and write access to Contents on the repositories you want to use, and Administration if
          Rehearsal should create repositories for you. It is stored encrypted and shared with your team.
        </p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        Token
        <input
          name="token"
          type="password"
          autoComplete="off"
          required
          className="rounded-md border border-hairline px-3 py-2 font-mono text-sm"
        />
      </label>
      {state.error && <p className="text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "Checking…" : "Connect"}
      </button>
    </form>
  );
}

function CreateForm({ login }: { login: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createProject, {});
  const [mode, setMode] = useState<"create" | "existing">("create");

  return (
    <form action={action} className="flex flex-col gap-6">
      <p className="text-sm text-muted">Connected to GitHub as {login}.</p>

      <label className="flex flex-col gap-1.5 text-sm">
        Project name
        <input
          name="name"
          required
          autoFocus
          placeholder="Checkout redesign"
          className="rounded-md border border-hairline px-3 py-2 text-base"
        />
      </label>

      <div className="flex flex-col gap-3 text-sm">
        <span>Repository</span>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="repoMode"
            value="create"
            checked={mode === "create"}
            onChange={() => setMode("create")}
            className="accent-black"
          />
          Create a private one for this project
        </label>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="repoMode"
            value="existing"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
            className="accent-black"
          />
          Use one that exists
        </label>
        {mode === "existing" && (
          <div className="ml-7 flex flex-col gap-3">
            <input
              name="repoFullName"
              placeholder="owner/repository"
              className="rounded-md border border-hairline px-3 py-2 font-mono text-sm"
            />
            <input
              name="path"
              placeholder="folder inside it (optional)"
              className="rounded-md border border-hairline px-3 py-2 font-mono text-sm"
            />
          </div>
        )}
      </div>

      {state.error && <p className="text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
