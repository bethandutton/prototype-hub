import type { Block, BlockInfo, Comment, Decision, Folder, InsightLink, Mode, PageVersion, Prototype, ResourceLink, Workspace } from "@core/types";
import type { DesignLibrary } from "@core/library";

export type { Block, BlockInfo, BlockVersion, Comment, Decision, Folder, InsightLink, Mode, PageVersion, Prototype, ResourceLink, Workspace } from "@core/types";

declare global {
  interface Window {
    rehearsal?: { isDesktop: boolean; pickFolder(title: string): Promise<string | null>; reveal(target: string): Promise<void> };
  }
}

export interface PrototypeData {
  prototype: Prototype;
  blockMap: BlockInfo[];
  blocks: Block[];
  comments: Comment[];
  versions: PageVersion[];
  decisions: Decision[];
  insights: InsightLink[];
  files: string[];
}

export interface Connection {
  port: number;
  httpUrl: string;
  stdioCommand: string;
  skillFile: string;
  claude: { http: string; stdio: string };
  json: unknown;
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => call<{ name: string; set: boolean }>("GET", "/api/me"),
  setMe: (name: string) => call<{ name: string }>("PUT", "/api/me", { name }),
  connection: () => call<Connection>("GET", "/api/connection"),
  skill: () => call<{ file: string; content: string }>("GET", "/api/skill"),

  workspaces: () => call<Workspace[]>("GET", "/api/workspaces"),
  addWorkspace: (name: string, path: string) => call<Workspace>("POST", "/api/workspaces", { name, path }),
  updateWorkspace: (id: string, patch: { name?: string; designLibraryRepo?: string }) => call<Workspace>("PATCH", `/api/workspaces/${id}`, patch),
  removeWorkspace: (id: string) => call<{ removed: boolean }>("DELETE", `/api/workspaces/${id}`),
  tree: (id: string) => call<{ folders: Folder[]; prototypes: Prototype[] }>("GET", `/api/workspaces/${id}/tree`),
  library: (id: string) => call<DesignLibrary | null>("GET", `/api/workspaces/${id}/library`),
  createFolder: (id: string, parent: string, name: string) => call<Folder>("POST", `/api/workspaces/${id}/folders`, { parent, name }),
  createPrototype: (id: string, input: { folder: string; title: string; description: string; mode: Mode; html: string; resourceLinks: ResourceLink[] }) =>
    call<Prototype>("POST", `/api/workspaces/${id}/prototypes`, input),

  prototype: (id: string) => call<PrototypeData>("GET", `/api/prototypes/${id}`),
  updatePrototype: (id: string, patch: Partial<Pick<Prototype, "title" | "description" | "mode" | "resourceLinks">>) =>
    call<Prototype>("PATCH", `/api/prototypes/${id}`, patch),
  proposeVersion: (id: string, blockId: string, content: string, rationale: string) =>
    call<{ block: Block }>("POST", `/api/prototypes/${id}/blocks/${blockId}/versions`, { content, rationale }),
  selectVersion: (id: string, blockId: string, versionId: string) => call<Block>("POST", `/api/prototypes/${id}/blocks/${blockId}/select`, { versionId }),
  addComment: (id: string, input: { body: string; blockId?: string | null; parentId?: string | null }) => call<Comment>("POST", `/api/prototypes/${id}/comments`, input),
  resolveComment: (id: string, commentId: string, resolved: boolean) => call<Comment>("POST", `/api/prototypes/${id}/comments/${commentId}/resolve`, { resolved }),
  addInsight: (id: string, input: { blockId?: string | null; query: string }) => call<InsightLink>("POST", `/api/prototypes/${id}/insights`, input),
};

export type ChangeEvent = { type: string; prototypeId?: string; workspaceId?: string };

// Anything that changes on disk, from an agent, a sync folder or this app,
// arrives here so the screen can refresh itself.
export function subscribe(onEvent: (e: ChangeEvent) => void): () => void {
  const source = new EventSource("/events");
  source.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {
      // ignore malformed events
    }
  };
  return () => source.close();
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export async function pickFolder(title: string): Promise<string | null> {
  if (window.rehearsal?.pickFolder) return window.rehearsal.pickFolder(title);
  const typed = window.prompt(`${title}\n\nType the full path of the folder:`);
  return typed?.trim() || null;
}
