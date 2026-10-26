import type { Workspace } from "./api";
import type { Route, Tree } from "./App";
import { go } from "./App";
import { Icon, Menu, initials } from "./ui";

export function Sidebar({
  workspaces,
  active,
  tree,
  route,
  me,
  port,
  onSwitch,
  onAddWorkspace,
  onSettings,
  onRename,
}: {
  workspaces: Workspace[];
  active: Workspace | undefined;
  tree: Tree | null;
  route: Route;
  me: string;
  port: number | null;
  onSwitch: (id: string) => void;
  onAddWorkspace: () => void;
  onSettings: () => void;
  onRename: () => void;
}) {
  const currentFolder = route.view === "workspace" ? route.folder : null;
  const currentProto = route.view === "prototype" ? route.id : null;

  const renderFolder = (parent: string, depth: number) => {
    if (!tree) return null;
    const folders = tree.folders.filter((f) => f.parent === parent);
    const protos = tree.prototypes.filter((p) => p.folder === parent);
    return (
      <>
        {folders.map((f) => (
          <div key={f.path}>
            <button className={`nav-item ${currentFolder === f.path ? "on" : ""}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => go(`/w/${active!.id}?f=${encodeURIComponent(f.path)}`)}>
              <span className="muted">
                <Icon name="folder" size={14} />
              </span>
              <span className="truncate grow">{f.name}</span>
            </button>
            {renderFolder(f.path, depth + 1)}
          </div>
        ))}
        {protos.map((p) => (
          <button key={p.id} className={`nav-item ${currentProto === p.id ? "on" : ""}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => go(`/p/${p.id}`)}>
            <span className="muted">
              <Icon name="file" size={14} />
            </span>
            <span className="truncate grow">{p.title}</span>
          </button>
        ))}
      </>
    );
  };

  return (
    <aside className="sidebar">
      <div className="wordmark">
        <img src="/logo-mark.svg" alt="" width={16} height={16} />
        Rehearsal
      </div>
      <Menu
        trigger={() => (
          <button className="switcher">
            <span className="name truncate">{active?.name ?? "Choose a workspace"}</span>
            <span className="muted">
              <Icon name="chevron-down" size={14} />
            </span>
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="menu-label">Workspaces</div>
            {workspaces.map((w) => (
              <button
                key={w.id}
                className={`menu-item ${w.id === active?.id ? "on" : ""}`}
                onClick={() => {
                  close();
                  onSwitch(w.id);
                }}
              >
                <span className="truncate">{w.name}</span>
                {w.id === active?.id && <Icon name="check" size={14} />}
              </button>
            ))}
            <div className="hair" />
            <button
              className="menu-item"
              onClick={() => {
                close();
                onAddWorkspace();
              }}
            >
              Add a workspace…
            </button>
            {active && (
              <button
                className="menu-item"
                onClick={() => {
                  close();
                  onSettings();
                }}
              >
                Workspace settings…
              </button>
            )}
          </>
        )}
      </Menu>

      <nav className="nav">
        {active && (
          <button className={`nav-item ${currentFolder === "" ? "on" : ""}`} onClick={() => go(`/w/${active.id}`)}>
            <span className="truncate grow">All prototypes</span>
            {tree && <span className="muted">{tree.prototypes.length}</span>}
          </button>
        )}
        {renderFolder("", 1)}
      </nav>

      <div className="sidebar-foot">
        <button className={`nav-item ${route.view === "connect" ? "on" : ""}`} onClick={() => go("/connect")}>
          <span className="chip">
            <span className="dot" />
            Agent
          </span>
          <span className="muted small truncate grow">{port ? `MCP on port ${port}` : "Starting…"}</span>
        </button>
        <button className="me" onClick={onRename} title="Change your name">
          <span className="avatar">{initials(me)}</span>
          <span className="truncate grow">{me}</span>
        </button>
      </div>
    </aside>
  );
}
