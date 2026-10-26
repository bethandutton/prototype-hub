import { useState } from "react";
import { api, pickFolder } from "./api";
import { Field } from "./ui";

export function Welcome({ step, onDone }: { step: "name" | "workspace"; onDone: () => void }) {
  const [name, setName] = useState("");
  const [wsName, setWsName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");

  if (step === "name") {
    return (
      <div className="centre">
        <h1>Welcome to Rehearsal</h1>
        <p className="lead">The place your AI-built prototypes live, with every decision kept. First, what should we call you?</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            api.setMe(name).then(onDone);
          }}
        >
          <Field label="Your name" hint="Shown on your versions, decisions and comments.">
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Bethan" />
          </Field>
          <button className="btn primary" disabled={!name.trim()}>
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="centre">
      <h1>Create a workspace</h1>
      <p className="lead">
        A workspace is a folder on your Mac. Prototypes, versions and comments are plain files inside it, so you can back it up or share it through Google Drive like any other folder.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api
            .addWorkspace(wsName, path)
            .then(onDone)
            .catch((err) => setError(err.message));
        }}
      >
        <Field label="Folder" hint="An empty folder for a new workspace, or a shared folder to join a teammate's.">
          <div className="row">
            <input className="input grow" placeholder="/Users/you/Prototypes" value={path} onChange={(e) => setPath(e.target.value)} />
            <button type="button" className="btn" onClick={() => pickFolder("Choose the workspace folder").then((p) => p && setPath(p))}>
              Choose…
            </button>
          </div>
        </Field>
        <Field label="Name">
          <input className="input" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Marketing" />
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={!path.trim()}>
          Create workspace
        </button>
      </form>
    </div>
  );
}
