// The data model, as it is kept on disk. Every record is its own small
// JSON file so two people sharing a folder never write the same file.

export type Plan = "free" | "solo" | "teams";
export type Mode = "wireframe" | "production";
export type Source = "human" | "agent";

export interface ResourceLink {
  label: string;
  url: string;
}

// workspace.json at the root of a workspace folder.
export interface WorkspaceFile {
  id: string;
  name: string;
  designLibraryRepo?: string;
  plan: Plan;
  createdAt: string;
}

export interface Workspace extends WorkspaceFile {
  path: string;
}

// prototype.json inside a prototype's folder.
export interface PrototypeFile {
  id: string;
  title: string;
  description: string;
  mode: Mode;
  entry: string;
  resourceLinks: ResourceLink[];
  createdAt: string;
  updatedAt: string;
}

export interface Prototype extends PrototypeFile {
  workspaceId: string;
  // Folder of the prototype, relative to the workspace root.
  dir: string;
  // Folder it sits in, relative to the workspace root. "" is the root.
  folder: string;
}

export interface Folder {
  path: string;
  name: string;
  parent: string;
}

export interface BlockInfo {
  id: string;
  tag: string;
  label: string;
}

export interface BlockVersion {
  id: string;
  blockId: string;
  author: string;
  content: string;
  rationale: string;
  createdAt: string;
  source: Source;
}

export interface Selection {
  blockId: string;
  versionId: string;
  by: string;
  at: string;
}

export interface Block extends BlockInfo {
  selectedVersionId: string | null;
  versions: BlockVersion[];
}

export interface Comment {
  id: string;
  prototypeId: string;
  blockId: string | null;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PageVersion {
  id: string;
  author: string;
  message: string;
  rationale: string;
  createdAt: string;
  source: Source;
}

export interface InsightLink {
  id: string;
  blockId: string | null;
  provider: "posthog";
  query: string;
  createdAt: string;
}

// One entry in a prototype's decision timeline.
export interface Decision {
  at: string;
  by: string;
  blockId: string;
  blockLabel: string;
  versionId: string;
  versionAuthor: string;
  rationale: string;
}

export interface Settings {
  name: string;
}
