"use client";

import { useActionState, useState } from "react";
import { createProject, type ActionResult } from "@/lib/actions";
import { ConnectGithub } from "@/components/connect-github";

type Storage = "github" | "google-drive" | "rehearsal-cloud";

type Props = {
  githubLogin: string | null;
  driveEmail: string | null;
  driveAvailable: boolean;
  initialStorage: Storage;
  error: string | null;
};

export function NewProjectForm({ githubLogin, driveEmail, driveAvailable, initialStorage, error }: Props) {
  const [storage, setStorage] = useState<Storage>(initialStorage);

  const storages: { id: Storage; name: string; blurb: string; note?: string; disabled?: boolean }[] = [
    {
      id: "github",
      name: "GitHub",
      blurb: "A repository your team owns. Agents already know how to work in one, and every change is kept.",
      note: githubLogin ? `Connected as ${githubLogin}` : undefined,
    },
    {
      id: "google-drive",
      name: "Google Drive",
      blurb: "A shared folder that syncs to everyone's machine, so your agent edits the files right there.",
      note: driveEmail ? `Connected as ${driveEmail}` : driveAvailable ? undefined : "Not switched on yet",
      disabled: !driveAvailable,
    },
    {
      id: "rehearsal-cloud",
      name: "Rehearsal Cloud",
      blurb: "We keep the files for you. Nothing to connect.",
      note: "Coming soon, paid plan",
      disabled: true,
    },
  ];

  return (
    <div className="mt-14 grid gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <fieldset>
        <legend className="text-lg">Where the files live</legend>
        <ul className="mt-5 border-t border-hairline">
          {storages.map((s) => (
            <li key={s.id} className="border-b border-hairline">
              <label
                className={`flex cursor-pointer items-start gap-4 py-5 ${s.disabled ? "cursor-default text-faint" : ""}`}
              >
                <input
                  type="radio"
                  name="storage-choice"
                  value={s.id}
                  checked={storage === s.id}
                  disabled={s.disabled}
                  onChange={() => setStorage(s.id)}
                  className="mt-1.5 accent-black"
                />
                <span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-base">{s.name}</span>
                    {s.note && <span className="text-xs text-faint">{s.note}</span>}
                  </span>
                  <span className={`mt-1 block text-sm ${s.disabled ? "" : "text-muted"}`}>{s.blurb}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        {error && <p className="mb-6 text-sm">{error}</p>}
        {storage === "github" &&
          (githubLogin ? (
            <CreateForm storage="github" />
          ) : (
            <div>
              <h2 className="text-lg">Connect GitHub</h2>
              <div className="mt-5">
                <ConnectGithub />
              </div>
            </div>
          ))}
        {storage === "google-drive" && (driveEmail ? <CreateForm storage="google-drive" /> : <ConnectDrive />)}
      </div>
    </div>
  );
}

function ConnectDrive() {
  return (
    <div className="flex max-w-[480px] flex-col gap-5">
      <h2 className="text-lg">Connect Google Drive</h2>
      <p className="text-sm text-muted">
        Sign in with the Google account that can see your team&rsquo;s shared folder. Rehearsal only touches the
        folders you point projects at.
      </p>
      <a
        href="/api/google/start"
        className="self-start rounded-md bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-80"
      >
        Sign in with Google
      </a>
    </div>
  );
}

function CreateForm({ storage }: { storage: "github" | "google-drive" }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createProject, {});
  const [mode, setMode] = useState<"create" | "existing">("create");

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="storage" value={storage} />

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

      {storage === "github" ? (
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
      ) : (
        <label className="flex flex-col gap-1.5 text-sm">
          Drive folder
          <input
            name="folder"
            required
            placeholder="Paste the link to the folder"
            className="rounded-md border border-hairline px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted">
            In Drive, right-click the folder, choose Share, then Copy link. Shared drives work too.
          </span>
        </label>
      )}

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
