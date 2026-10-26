import { useState } from "react";
import { api, timeAgo, type Mode, type ResourceLink, type Workspace } from "./api";
import { go, type Tree } from "./App";
import { Thumb } from "./Thumb";
import { Dialog, Field, Icon, ModeBadge } from "./ui";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function Browser({ workspace, tree, folder, onChanged }: { workspace: Workspace; tree: Tree | null; folder: string; onChanged: () => void }) {
  const [dialog, setDialog] = useState<"folder" | "prototype" | null>(null);
  const folders = tree?.folders.filter((f) => f.parent === folder) ?? [];
  const prototypes = tree?.prototypes.filter((p) => p.folder === folder) ?? [];
  const crumbs = folder ? folder.split("/") : [];
  const tick = tree ? tree.prototypes.map((p) => p.updatedAt).join("|").length : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <button onClick={() => go(`/w/${workspace.id}`)}>{workspace.name}</button>
            {crumbs.map((c, i) => (
              <span key={i} className="row">
                <Icon name="chevron-right" size={12} />
                <button onClick={() => go(`/w/${workspace.id}?f=${encodeURIComponent(crumbs.slice(0, i + 1).join("/"))}`)}>{c}</button>
              </span>
            ))}
          </div>
          <h1>{crumbs.length ? crumbs[crumbs.length - 1] : "All prototypes"}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setDialog("folder")}>
            New folder
          </button>
          <button className="btn primary" onClick={() => setDialog("prototype")}>
            <Icon name="plus" size={14} />
            New prototype
          </button>
        </div>
      </div>

      {tree && folders.length === 0 && prototypes.length === 0 && (
        <div className="empty">
          <h2>Nothing here yet</h2>
          <p>Add a prototype by pasting its HTML, or ask your agent to create one in this workspace.</p>
        </div>
      )}

      <div className="grid">
        {folders.map((f) => (
          <button key={f.path} className="card" onClick={() => go(`/w/${workspace.id}?f=${encodeURIComponent(f.path)}`)}>
            <div className="thumb folder">
              <Icon name="folder" size={36} />
            </div>
            <div className="card-title">
              <span className="truncate">{f.name}</span>
            </div>
            <div className="card-meta">
              {plural(tree!.prototypes.filter((p) => p.folder === f.path || p.folder.startsWith(f.path + "/")).length, "prototype")}
            </div>
          </button>
        ))}
        {prototypes.map((p) => (
          <button key={p.id} className="card" onClick={() => go(`/p/${p.id}`)}>
            <Thumb id={p.id} tick={tick} />
            <div className="card-title">
              <span className="truncate">{p.title}</span>
              <ModeBadge mode={p.mode} />
            </div>
            <div className="card-meta truncate">{p.description || `Updated ${timeAgo(p.updatedAt)}`}</div>
          </button>
        ))}
      </div>

      {dialog === "folder" && (
        <NewFolderDialog
          onClose={() => setDialog(null)}
          onCreate={(name) =>
            api.createFolder(workspace.id, folder, name).then(() => {
              setDialog(null);
              onChanged();
            })
          }
        />
      )}
      {dialog === "prototype" && (
        <NewPrototypeDialog
          onClose={() => setDialog(null)}
          onCreate={(input) =>
            api.createPrototype(workspace.id, { ...input, folder }).then((p) => {
              setDialog(null);
              onChanged();
              go(`/p/${p.id}`);
            })
          }
        />
      )}
    </div>
  );
}

function NewFolderDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="New folder" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name).catch((err) => setError(err.message));
        }}
      >
        <Field label="Name">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const STARTER = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Untitled</title>
  <style>
    body { margin: 0; font: 16px/1.5 -apple-system, system-ui, sans-serif; color: #171717; }
    main { max-width: 720px; margin: 80px auto; padding: 0 24px; }
  </style>
</head>
<body>
  <main>
    <h1>Hello</h1>
    <p>Replace this with your prototype.</p>
  </main>
</body>
</html>
`;

export function NewPrototypeDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: { title: string; description: string; mode: Mode; html: string; resourceLinks: ResourceLink[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("wireframe");
  const [html, setHtml] = useState(STARTER);
  const [error, setError] = useState("");

  const readFile = (file: File) => {
    file.text().then((text) => {
      setHtml(text);
      if (!title) setTitle(file.name.replace(/\.html?$/i, ""));
    });
  };

  return (
    <Dialog title="New prototype" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ title, description, mode, html, resourceLinks: [] }).catch((err) => setError(err.message));
        }}
      >
        <Field label="Title">
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line on what this explores" />
        </Field>
        <Field label="Mode">
          <div className="row">
            <button type="button" className={`btn ${mode === "wireframe" ? "on" : ""}`} onClick={() => setMode("wireframe")}>
              Wireframe
            </button>
            <button type="button" className={`btn ${mode === "production" ? "on" : ""}`} onClick={() => setMode("production")}>
              Production-ready
            </button>
          </div>
        </Field>
        <Field label="HTML" hint="Paste the page, or choose an .html file. Block ids are added when it is saved.">
          <textarea className="textarea code" value={html} onChange={(e) => setHtml(e.target.value)} />
          <input type="file" accept=".html,.htm,text/html" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!title.trim() || !html.trim()}>
            Create
          </button>
        </div>
      </form>
    </Dialog>
  );
}
