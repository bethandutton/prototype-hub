import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { driveVersions, type DriveVersionFile, type Project } from "@/db/schema";
import * as drive from "@/lib/google-drive";
import * as github from "@/lib/github";
import { driveAccessToken, githubToken } from "@/lib/projects";

// One interface over the places a project's files can live. "ref" is a
// version id: a commit for GitHub, a recorded version for Drive, or "head"
// for whatever is there right now.

export type StoredFile = { path: string; size: number };
export type Version = { id: string; message: string; author: string; date: string };
export type FileToWrite = { path: string; content: Buffer };
export type Author = { name: string; email: string };

export interface Store {
  head(): Promise<string>;
  listFiles(ref: string): Promise<StoredFile[]>;
  readFile(ref: string, path: string): Promise<Buffer | null>;
  listVersions(): Promise<Version[]>;
  write(files: FileToWrite[], message: string, mode: "snapshot" | "update", author: Author): Promise<string>;
  // Where the files are, for people: "owner/repo/folder" or a Drive folder name.
  location: string;
}

export async function storeFor(project: Project): Promise<Store> {
  if (project.storage === "google-drive") return driveStore(project);
  return githubStore(project);
}

async function githubStore(project: Project): Promise<Store> {
  const token = await githubToken(project.orgId);
  const repo = { owner: project.repoOwner!, repo: project.repoName! };
  const branch = project.branch!;
  const resolve = async (ref: string) => (ref === "head" ? github.headSha(token, repo, branch) : ref);

  return {
    location: `${repo.owner}/${repo.repo}${project.path ? `/${project.path}` : ""}`,
    head: () => github.headSha(token, repo, branch),
    listFiles: async (ref) => (await github.listFiles(token, repo, await resolve(ref), project.path)).map((f) => ({ path: f.path, size: f.size })),
    readFile: async (ref, path) => {
      const file = (await github.listFiles(token, repo, await resolve(ref), project.path)).find((f) => f.path === path);
      return file ? github.readBlob(token, repo, file.sha) : null;
    },
    listVersions: async () =>
      (await github.listVersions(token, repo, branch, project.path)).map((v) => ({
        id: v.sha,
        message: v.message,
        author: v.author,
        date: v.date,
      })),
    write: (files, message, mode, author) => github.commitFiles(token, repo, branch, project.path, files, message, mode, author),
  };
}

function sameFiles(a: DriveVersionFile[], b: DriveVersionFile[]) {
  if (a.length !== b.length) return false;
  const key = (f: DriveVersionFile) => `${f.path}:${f.fileId}:${f.revisionId}`;
  const set = new Set(a.map(key));
  return b.every((f) => set.has(key(f)));
}

async function driveStore(project: Project): Promise<Store> {
  const token = await driveAccessToken(project.orgId);
  const folderId = project.driveFolderId!;
  const db = getDb();

  const versions = () => db.select().from(driveVersions).where(eq(driveVersions.projectId, project.id)).orderBy(desc(driveVersions.createdAt));

  const record = async (files: DriveVersionFile[], message: string, author: string) => {
    const [row] = await db.insert(driveVersions).values({ projectId: project.id, files, message, author }).returning({ id: driveVersions.id });
    return row.id;
  };

  // The live folder is the truth. If it differs from the last recorded
  // version (someone's agent edited the synced folder, say), that change is
  // recorded as a version too, so history stays complete.
  const head = async () => {
    const live = await drive.walk(token, folderId);
    const [latest] = await versions();
    if (latest && sameFiles(latest.files, live)) return latest.id;
    return record(live, latest ? "Changed in the Drive folder" : "First look at the folder", "Google Drive");
  };

  const filesAt = async (ref: string): Promise<DriveVersionFile[]> => {
    const id = ref === "head" ? await head() : ref;
    const [row] = await db.select().from(driveVersions).where(eq(driveVersions.id, id)).limit(1);
    return row?.files ?? [];
  };

  return {
    location: `Google Drive folder`,
    head,
    listFiles: async (ref) => (await filesAt(ref)).map((f) => ({ path: f.path, size: f.size })),
    readFile: async (ref, path) => {
      const file = (await filesAt(ref)).find((f) => f.path === path);
      if (!file) return null;
      const live = await drive.walk(token, folderId);
      const current = live.find((f) => f.fileId === file.fileId);
      // Reading the current revision directly is cheaper and works for every file type.
      return current?.revisionId === file.revisionId
        ? drive.download(token, file.fileId)
        : drive.download(token, file.fileId, file.revisionId);
    },
    listVersions: async () =>
      (await versions()).map((v) => ({ id: v.id, message: v.message, author: v.author, date: v.createdAt.toISOString() })),
    write: async (files, message, mode, author) => {
      const live = await drive.walk(token, folderId);
      const written = new Map<string, DriveVersionFile>();
      for (const file of files) written.set(file.path, await drive.writeFile(token, folderId, live, file.path, file.content));
      const kept: DriveVersionFile[] = [];
      for (const f of live) {
        if (written.has(f.path)) continue;
        if (mode === "snapshot") await drive.trash(token, f.fileId);
        else kept.push(f);
      }
      return record([...kept, ...written.values()], message, author.name);
    },
  };
}
