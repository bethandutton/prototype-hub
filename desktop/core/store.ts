import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exists, listDirs, listJson, newId, now, readJson, readText, slug, writeJson, writeText } from "./fs";
import { blockInfo, blockMap, ensureBlockIds, getBlock, normaliseBlock, setBlock } from "./html";
import type {
  Block,
  BlockInfo,
  BlockVersion,
  Comment,
  Decision,
  Folder,
  InsightLink,
  Mode,
  PageVersion,
  Prototype,
  PrototypeFile,
  ResourceLink,
  Selection,
  Settings,
  Source,
  Workspace,
  WorkspaceFile,
} from "./types";

// Everything the app and the MCP server know lives in two places: the
// workspace folders themselves, and a small registry in the app's data
// folder that remembers where those workspaces are and who you are.

export const WORKSPACE_FILE = "workspace.json";
export const PROTOTYPE_FILE = "prototype.json";
export const HISTORY_DIR = "history";
const SKIP_DIRS = new Set(["node_modules", ".git", HISTORY_DIR]);

export function defaultHome(): string {
  if (process.env.REHEARSAL_HOME) return process.env.REHEARSAL_HOME;
  return path.join(os.homedir(), "Library", "Application Support", "Rehearsal");
}

interface Registry {
  workspaces: { id: string; path: string }[];
}

export class Store {
  constructor(readonly home: string = defaultHome()) {
    fs.mkdirSync(home, { recursive: true });
  }

  // Registry and settings

  private registryFile() {
    return path.join(this.home, "workspaces.json");
  }

  private registry(): Registry {
    return readJson<Registry>(this.registryFile()) ?? { workspaces: [] };
  }

  settings(): Settings {
    return readJson<Settings>(path.join(this.home, "settings.json")) ?? { name: "" };
  }

  setSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.settings(), ...patch };
    writeJson(path.join(this.home, "settings.json"), next);
    return next;
  }

  me(): string {
    return this.settings().name || os.userInfo().username;
  }

  // Workspaces

  listWorkspaces(): Workspace[] {
    const out: Workspace[] = [];
    for (const entry of this.registry().workspaces) {
      const file = readJson<WorkspaceFile>(path.join(entry.path, WORKSPACE_FILE));
      if (file) out.push({ ...file, path: entry.path });
    }
    return out;
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.listWorkspaces().find((w) => w.id === id);
  }

  // Points the app at a folder. A folder that already holds a workspace is
  // adopted as it is, so two people can share one through Drive.
  addWorkspace(input: { name: string; path: string }): Workspace {
    const dir = path.resolve(input.path.replace(/^~(?=$|\/)/, os.homedir()));
    fs.mkdirSync(dir, { recursive: true });
    let file = readJson<WorkspaceFile>(path.join(dir, WORKSPACE_FILE));
    if (!file) {
      file = { id: newId(), name: input.name || path.basename(dir), plan: "free", createdAt: now() };
      writeJson(path.join(dir, WORKSPACE_FILE), file);
    }
    const reg = this.registry();
    if (!reg.workspaces.some((w) => w.path === dir)) {
      reg.workspaces.push({ id: file.id, path: dir });
      writeJson(this.registryFile(), reg);
    }
    return { ...file, path: dir };
  }

  updateWorkspace(id: string, patch: Partial<Pick<WorkspaceFile, "name" | "designLibraryRepo" | "plan">>): Workspace {
    const ws = this.getWorkspace(id);
    if (!ws) throw new Error("No such workspace.");
    const { path: p, ...file } = ws;
    const next: WorkspaceFile = { ...file, ...patch };
    if (next.designLibraryRepo === "") delete next.designLibraryRepo;
    writeJson(path.join(p, WORKSPACE_FILE), next);
    return { ...next, path: p };
  }

  removeWorkspace(id: string): void {
    const reg = this.registry();
    reg.workspaces = reg.workspaces.filter((w) => w.id !== id);
    writeJson(this.registryFile(), reg);
  }

  // Folders and prototypes

  tree(workspaceId: string): { folders: Folder[]; prototypes: Prototype[] } {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) throw new Error("No such workspace.");
    const folders: Folder[] = [];
    const prototypes: Prototype[] = [];
    const visit = (rel: string) => {
      for (const name of listDirs(path.join(ws.path, rel))) {
        if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
        const childRel = rel ? `${rel}/${name}` : name;
        const file = readJson<PrototypeFile>(path.join(ws.path, childRel, PROTOTYPE_FILE));
        if (file) {
          prototypes.push({ ...file, workspaceId, dir: childRel, folder: rel });
        } else {
          folders.push({ path: childRel, name, parent: rel });
          visit(childRel);
        }
      }
    };
    visit("");
    return { folders, prototypes };
  }

  createFolder(workspaceId: string, parent: string, name: string): Folder {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) throw new Error("No such workspace.");
    const clean = name.trim().replace(/[\/\\]/g, "-");
    if (!clean) throw new Error("A folder needs a name.");
    const rel = parent ? `${parent}/${clean}` : clean;
    fs.mkdirSync(path.join(ws.path, rel), { recursive: true });
    return { path: rel, name: clean, parent };
  }

  findPrototype(id: string): Prototype | undefined {
    for (const ws of this.listWorkspaces()) {
      const hit = this.tree(ws.id).prototypes.find((p) => p.id === id);
      if (hit) return hit;
    }
    return undefined;
  }

  listPrototypes(workspaceId?: string): Prototype[] {
    const spaces = workspaceId ? [this.getWorkspace(workspaceId)].filter(Boolean) : this.listWorkspaces();
    return spaces.flatMap((ws) => this.tree(ws!.id).prototypes);
  }

  absDir(proto: Prototype): string {
    const ws = this.getWorkspace(proto.workspaceId);
    if (!ws) throw new Error("No such workspace.");
    return path.join(ws.path, proto.dir);
  }

  private historyDir(proto: Prototype, ...parts: string[]) {
    return path.join(this.absDir(proto), HISTORY_DIR, ...parts);
  }

  createPrototype(
    workspaceId: string,
    input: {
      folder?: string;
      title: string;
      description?: string;
      mode?: Mode;
      html: string;
      resourceLinks?: ResourceLink[];
      author?: string;
      files?: { path: string; content: string }[];
    },
  ): Prototype {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) throw new Error("No such workspace.");
    const title = input.title.trim();
    if (!title) throw new Error("A prototype needs a title.");
    const folder = (input.folder ?? "").replace(/^\/+|\/+$/g, "");
    const base = slug(title);
    let name = base;
    for (let i = 2; exists(path.join(ws.path, folder, name)); i++) name = `${base}-${i}`;
    const dir = folder ? `${folder}/${name}` : name;
    const abs = path.join(ws.path, dir);
    fs.mkdirSync(abs, { recursive: true });
    const stamp = now();
    const file: PrototypeFile = {
      id: newId(),
      title,
      description: (input.description ?? "").trim(),
      mode: input.mode ?? "wireframe",
      entry: "index.html",
      resourceLinks: input.resourceLinks ?? [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    const { html } = ensureBlockIds(input.html);
    writeText(path.join(abs, file.entry), html);
    for (const extra of input.files ?? []) {
      const rel = extra.path.replace(/^\/+/, "");
      if (rel.includes("..") || rel === file.entry || rel === PROTOTYPE_FILE) continue;
      writeText(path.join(abs, rel), extra.content);
    }
    writeJson(path.join(abs, PROTOTYPE_FILE), file);
    const proto: Prototype = { ...file, workspaceId, dir, folder };
    this.recordPageVersion(proto, { author: input.author ?? this.me(), message: "Created", rationale: "", source: input.author ? "agent" : "human" }, html);
    return proto;
  }

  updatePrototype(id: string, patch: Partial<Pick<PrototypeFile, "title" | "description" | "mode" | "resourceLinks">>): Prototype {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const { workspaceId, dir, folder, ...file } = proto;
    const next: PrototypeFile = { ...file, ...patch, updatedAt: now() };
    writeJson(path.join(this.absDir(proto), PROTOTYPE_FILE), next);
    return { ...next, workspaceId, dir, folder };
  }

  readHtml(proto: Prototype): string {
    return readText(path.join(this.absDir(proto), proto.entry)) ?? "";
  }

  readFile(proto: Prototype, rel: string): Buffer | null {
    const abs = path.resolve(this.absDir(proto), rel);
    if (!abs.startsWith(this.absDir(proto) + path.sep) && abs !== this.absDir(proto)) return null;
    try {
      return fs.readFileSync(abs);
    } catch {
      return null;
    }
  }

  listFiles(proto: Prototype): string[] {
    const root = this.absDir(proto);
    const out: string[] = [];
    const visit = (rel: string) => {
      for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        if (entry.name === HISTORY_DIR || entry.name === PROTOTYPE_FILE || entry.name.startsWith(".")) continue;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) visit(childRel);
        else out.push(childRel);
      }
    };
    visit("");
    return out.sort();
  }

  // A page-level change: the whole entry file is replaced and a snapshot kept.
  updateHtml(
    id: string,
    input: { html: string; author?: string; message: string; rationale?: string; source?: Source; files?: { path: string; content: string }[] },
  ): PageVersion {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const { html } = ensureBlockIds(input.html);
    const abs = this.absDir(proto);
    writeText(path.join(abs, proto.entry), html);
    for (const extra of input.files ?? []) {
      const rel = extra.path.replace(/^\/+/, "");
      if (rel.includes("..") || rel === proto.entry || rel === PROTOTYPE_FILE) continue;
      writeText(path.join(abs, rel), extra.content);
    }
    this.touch(proto);
    return this.recordPageVersion(
      proto,
      { author: input.author ?? this.me(), message: input.message, rationale: input.rationale ?? "", source: input.source ?? "human" },
      html,
    );
  }

  private touch(proto: Prototype) {
    const { workspaceId, dir, folder, ...file } = proto;
    writeJson(path.join(this.absDir(proto), PROTOTYPE_FILE), { ...file, updatedAt: now() });
  }

  private recordPageVersion(proto: Prototype, v: Omit<PageVersion, "id" | "createdAt">, html: string): PageVersion {
    const version: PageVersion = { id: newId(), createdAt: now(), ...v };
    writeJson(this.historyDir(proto, "versions", `${version.id}.json`), version);
    writeText(this.historyDir(proto, "versions", `${version.id}.html`), html);
    return version;
  }

  pageVersions(proto: Prototype): PageVersion[] {
    return listJson<PageVersion>(this.historyDir(proto, "versions")).reverse();
  }

  pageVersionHtml(proto: Prototype, versionId: string): string | null {
    return readText(this.historyDir(proto, "versions", `${versionId}.html`));
  }

  // Blocks

  blockMap(proto: Prototype): BlockInfo[] {
    return blockMap(this.readHtml(proto));
  }

  private blockDir(proto: Prototype, blockId: string) {
    return this.historyDir(proto, "blocks", blockId);
  }

  private blockRecord(proto: Prototype, blockId: string): BlockInfo | null {
    return readJson<BlockInfo>(path.join(this.blockDir(proto, blockId), "block.json"));
  }

  private selectionOf(proto: Prototype, blockId: string): Selection | null {
    const all = listJson<Selection>(path.join(this.blockDir(proto, blockId), "selected"));
    return all.length ? all[all.length - 1] : null;
  }

  // Labels come from the live page where the block still exists, so a
  // block reads as what it says now, not what it said when first proposed.
  blocks(proto: Prototype): Block[] {
    const out: Block[] = [];
    const live = new Map(this.blockMap(proto).map((b) => [b.id, b]));
    for (const blockId of listDirs(this.historyDir(proto, "blocks"))) {
      const info = live.get(blockId) ?? this.blockRecord(proto, blockId);
      if (!info) continue;
      const versions = listJson<BlockVersion>(path.join(this.blockDir(proto, blockId), "versions"));
      const selected = this.selectionOf(proto, blockId);
      out.push({ ...info, versions, selectedVersionId: selected?.versionId ?? versions[0]?.id ?? null });
    }
    return out;
  }

  block(proto: Prototype, blockId: string): Block | null {
    return this.blocks(proto).find((b) => b.id === blockId) ?? null;
  }

  // The first proposal for a block also records what was there before, so
  // the original is always one of the alternatives.
  proposeBlockVersion(
    id: string,
    input: { blockId: string; content: string; rationale?: string; author?: string; source?: Source; select?: boolean },
  ): { block: Block; version: BlockVersion } {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const html = this.readHtml(proto);
    const info = blockInfo(html, input.blockId);
    if (!info) throw new Error(`No block with id ${input.blockId} in this prototype.`);
    const dir = this.blockDir(proto, input.blockId);
    if (!this.blockRecord(proto, input.blockId)) {
      writeJson(path.join(dir, "block.json"), info);
    }
    if (!listJson<BlockVersion>(path.join(dir, "versions")).length) {
      const original: BlockVersion = {
        id: newId(),
        blockId: input.blockId,
        author: "Original",
        content: getBlock(html, input.blockId) ?? "",
        rationale: "",
        createdAt: now(),
        source: "human",
      };
      writeJson(path.join(dir, "versions", `${original.id}.json`), original);
    }
    const version: BlockVersion = {
      id: newId(),
      blockId: input.blockId,
      author: input.author ?? this.me(),
      content: normaliseBlock(input.content, input.blockId),
      rationale: (input.rationale ?? "").trim(),
      createdAt: now(),
      source: input.source ?? (input.author ? "agent" : "human"),
    };
    writeJson(path.join(dir, "versions", `${version.id}.json`), version);
    if (input.select) this.selectBlockVersion(id, { blockId: input.blockId, versionId: version.id, by: version.author });
    return { block: this.block(proto, input.blockId)!, version };
  }

  // Picking a favourite makes it the live one: the page is rewritten and the
  // choice is appended to the block's history.
  selectBlockVersion(id: string, input: { blockId: string; versionId: string; by?: string }): Block {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const dir = this.blockDir(proto, input.blockId);
    const version = readJson<BlockVersion>(path.join(dir, "versions", `${input.versionId}.json`));
    if (!version) throw new Error("No such version.");
    const html = setBlock(this.readHtml(proto), input.blockId, version.content);
    writeText(path.join(this.absDir(proto), proto.entry), html);
    const selection: Selection = { blockId: input.blockId, versionId: input.versionId, by: input.by ?? this.me(), at: now() };
    writeJson(path.join(dir, "selected", `${newId()}.json`), selection);
    this.touch(proto);
    return this.block(proto, input.blockId)!;
  }

  decisions(proto: Prototype): Decision[] {
    const out: Decision[] = [];
    for (const block of this.blocks(proto)) {
      for (const sel of listJson<Selection>(path.join(this.blockDir(proto, block.id), "selected"))) {
        const version = block.versions.find((v) => v.id === sel.versionId);
        if (!version) continue;
        out.push({
          at: sel.at,
          by: sel.by,
          blockId: block.id,
          blockLabel: block.label,
          versionId: version.id,
          versionAuthor: version.author,
          rationale: version.rationale,
        });
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  // Comments

  comments(proto: Prototype): Comment[] {
    return listJson<Comment>(this.historyDir(proto, "comments"));
  }

  addComment(id: string, input: { body: string; blockId?: string | null; parentId?: string | null; author?: string }): Comment {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const body = input.body.trim();
    if (!body) throw new Error("A comment needs some text.");
    const comment: Comment = {
      id: newId(),
      prototypeId: id,
      blockId: input.blockId || null,
      parentId: input.parentId || null,
      author: input.author ?? this.me(),
      body,
      createdAt: now(),
      resolvedAt: null,
    };
    writeJson(this.historyDir(proto, "comments", `${comment.id}.json`), comment);
    return comment;
  }

  resolveComment(id: string, commentId: string, resolved = true): Comment {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const file = this.historyDir(proto, "comments", `${commentId}.json`);
    const comment = readJson<Comment>(file);
    if (!comment) throw new Error("No such comment.");
    comment.resolvedAt = resolved ? now() : null;
    writeJson(file, comment);
    return comment;
  }

  // Insights

  insightLinks(proto: Prototype): InsightLink[] {
    return listJson<InsightLink>(this.historyDir(proto, "insights"));
  }

  addInsightLink(id: string, input: { blockId?: string | null; query: string }): InsightLink {
    const proto = this.findPrototype(id);
    if (!proto) throw new Error("No such prototype.");
    const link: InsightLink = { id: newId(), blockId: input.blockId || null, provider: "posthog", query: input.query.trim(), createdAt: now() };
    writeJson(this.historyDir(proto, "insights", `${link.id}.json`), link);
    return link;
  }
}
