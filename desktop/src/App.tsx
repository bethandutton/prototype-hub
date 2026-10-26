import { useCallback, useEffect, useState } from "react";
import { api, pickFolder, subscribe, type ChangeEvent, type Folder, type Prototype, type Workspace } from "./api";
import { Sidebar } from "./Sidebar";
import { Browser } from "./Browser";
import { Viewer } from "./Viewer";
import { Connect } from "./Connect";
import { Welcome } from "./Welcome";
import { Dialog, Field } from "./ui";

export type Route = { view: "home" } | { view: "workspace"; id: string; folder: string } | { view: "prototype"; id: string } | { view: "connect" };

export function go(path: string) {
  window.location.hash = path;
}

function parseRoute(hash: string): Route {
  const [path, query] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "w" && parts[1]) return { view: "workspace", id: parts[1], folder: decodeURIComponent(new URLSearchParams(query).get("f") ?? "") };
  if (parts[0] === "p" && parts[1]) return { view: "prototype", id: parts[1] };
  if (parts[0] === "connect") return { view: "connect" };
  return { view: "home" };
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export type Tree = { folders: Folder[]; prototypes: Prototype[] };

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<{ name: string; set: boolean } | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem("rehearsal.workspace"));
  const [tree, setTree] = useState<Tree | null>(null);
  const [tick, setTick] = useState(0);
  const [lastEvent, setLastEvent] = useState<ChangeEvent | null>(null);
  const [full, setFull] = useState(false);
  const [dialog, setDialog] = useState<"name" | "add" | "settings" | null>(null);
  const [port, setPort] = useState<number | null>(null);

  const loadBasics = useCallback(async () => {
    const [m, ws] = await Promise.all([api.me(), api.workspaces()]);
    setMe(m);
    setWorkspaces(ws);
  }, []);

  useEffect(() => {
    void loadBasics();
    api.connection().then((c) => setPort(c.port)).catch(() => {});
    return subscribe((e) => {
      setLastEvent(e);
      setTick((t) => t + 1);
      if (e.type === "workspaces") void loadBasics();
    });
  }, [loadBasics]);

  // Which workspace the sidebar shows follows the route.
  useEffect(() => {
    if (route.view === "workspace") setActiveId(route.id);
  }, [route]);

  useEffect(() => {
    if (activeId) localStorage.setItem("rehearsal.workspace", activeId);
  }, [activeId]);

  const active = workspaces?.find((w) => w.id === activeId) ?? workspaces?.[0];

  useEffect(() => {
    if (!active) return setTree(null);
    let gone = false;
    api
      .tree(active.id)
      .then((t) => !gone && setTree(t))
      .catch(() => !gone && setTree(null));
    return () => {
      gone = true;
    };
  }, [active, tick]);

  if (!me || !workspaces) return null;

  if (!me.set) return <Welcome step="name" onDone={loadBasics} />;
  if (workspaces.length === 0) return <Welcome step="workspace" onDone={loadBasics} />;

  if (route.view === "home" && active) {
    go(`/w/${active.id}`);
    return null;
  }

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className={`app ${full ? "no-sidebar" : ""}`}>
      {!full && (
        <Sidebar
          workspaces={workspaces}
          active={active}
          tree={tree}
          route={route}
          me={me.name}
          port={port}
          onSwitch={(id) => go(`/w/${id}`)}
          onAddWorkspace={() => setDialog("add")}
          onSettings={() => setDialog("settings")}
          onRename={() => setDialog("name")}
        />
      )}
      <main className="main">
        {route.view === "workspace" && active && <Browser workspace={active} tree={tree} folder={route.folder} onChanged={refresh} />}
        {route.view === "prototype" && (
          <Viewer id={route.id} tick={tick} lastEvent={lastEvent} me={me.name} onFullPreview={setFull} onWorkspace={(id) => setActiveId(id)} />
        )}
        {route.view === "connect" && <Connect />}
      </main>

      {dialog === "name" && (
        <NameDialog
          name={me.name}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void loadBasics();
          }}
        />
      )}
      {dialog === "add" && (
        <AddWorkspaceDialog
          onClose={() => setDialog(null)}
          onAdded={(ws) => {
            setDialog(null);
            void loadBasics();
            go(`/w/${ws.id}`);
          }}
        />
      )}
      {dialog === "settings" && active && (
        <SettingsDialog
          workspace={active}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void loadBasics();
          }}
        />
      )}
    </div>
  );
}

function NameDialog({ name, onClose, onSaved }: { name: string; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <Dialog title="Your name" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api.setMe(value).then(onSaved);
        }}
      >
        <Field label="Shown on your versions, decisions and comments">
          <input className="input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!value.trim()}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddWorkspaceDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (ws: Workspace) => void }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="Add a workspace" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 16 }}>
        A workspace is a folder on disk. Pick an empty folder for a new one, or a folder a teammate shares with you through Google Drive to join theirs.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api
            .addWorkspace(name, path)
            .then(onAdded)
            .catch((err) => setError(err.message));
        }}
      >
        <Field label="Folder">
          <div className="row">
            <input className="input grow" placeholder="/Users/you/Prototypes" value={path} onChange={(e) => setPath(e.target.value)} />
            <button
              type="button"
              className="btn"
              onClick={() => pickFolder("Choose the workspace folder").then((p) => p && setPath(p))}
            >
              Choose…
            </button>
          </div>
        </Field>
        <Field label="Name" hint="Ignored if the folder already holds a workspace.">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing" />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!path.trim()}>
            Add
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SettingsDialog({ workspace, onClose, onSaved }: { workspace: Workspace; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(workspace.name);
  const [repo, setRepo] = useState(workspace.designLibraryRepo ?? "");
  const [error, setError] = useState("");
  return (
    <Dialog title="Workspace settings" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          api
            .updateWorkspace(workspace.id, { name, designLibraryRepo: repo })
            .then(onSaved)
            .catch((err) => setError(err.message));
        }}
      >
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Folder">
          <input className="input" value={workspace.path} readOnly />
        </Field>
        <Field
          label="Design library"
          hint="A repository on this machine. Agents are given its tokens, components and rules before they build anything, so generated UI uses the real design system."
        >
          <div className="row">
            <input className="input grow" placeholder="/Users/you/code/design-system" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <button type="button" className="btn" onClick={() => pickFolder("Choose the design library repository").then((p) => p && setRepo(p))}>
              Choose…
            </button>
          </div>
        </Field>
        <Field label="Plan" hint="Free is fully local. Share the folder through Google Drive or any shared folder to work with others.">
          <input className="input" value="Free" readOnly />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn quiet"
            style={{ marginRight: "auto" }}
            onClick={() => {
              if (window.confirm("Remove this workspace from Rehearsal? The folder and its files stay where they are.")) {
                api.removeWorkspace(workspace.id).then(() => {
                  localStorage.removeItem("rehearsal.workspace");
                  go("/");
                  onSaved();
                });
              }
            }}
          >
            Remove from Rehearsal
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Dialog>
  );
}
