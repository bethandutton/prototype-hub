import { Octokit } from "octokit";

export type RepoRef = { owner: string; repo: string };

export type TreeFile = { path: string; sha: string; size: number };

export type Version = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export function client(token: string) {
  return new Octokit({ auth: token });
}

export async function whoAmI(token: string) {
  const { data } = await client(token).rest.users.getAuthenticated();
  return { login: data.login, name: data.name ?? data.login };
}

export async function createRepo(token: string, name: string) {
  const { data } = await client(token).rest.repos.createForAuthenticatedUser({
    name,
    private: true,
    auto_init: true,
    description: "Prototypes reviewed in Rehearsal",
  });
  return { owner: data.owner.login, repo: data.name, branch: data.default_branch };
}

export async function getRepo(token: string, ref: RepoRef) {
  const { data } = await client(token).rest.repos.get(ref);
  return { owner: data.owner.login, repo: data.name, branch: data.default_branch };
}

export async function headSha(token: string, ref: RepoRef, branch: string) {
  const { data } = await client(token).rest.git.getRef({ ...ref, ref: `heads/${branch}` });
  return data.object.sha;
}

// Files under `dir` at a given commit, with paths relative to `dir`.
export async function listFiles(token: string, ref: RepoRef, sha: string, dir: string) {
  const { data } = await client(token).rest.git.getTree({ ...ref, tree_sha: sha, recursive: "1" });
  const prefix = dir ? `${dir}/` : "";
  const files: TreeFile[] = [];
  for (const item of data.tree) {
    if (item.type !== "blob" || !item.path || !item.sha) continue;
    if (!item.path.startsWith(prefix)) continue;
    files.push({ path: item.path.slice(prefix.length), sha: item.sha, size: item.size ?? 0 });
  }
  return files;
}

// Blob contents never change for a given sha, so they are safe to cache for the
// life of the server instance.
const blobCache = new Map<string, Buffer>();

export async function readBlob(token: string, ref: RepoRef, sha: string) {
  const cached = blobCache.get(sha);
  if (cached) return cached;
  const { data } = await client(token).rest.git.getBlob({ ...ref, file_sha: sha });
  const buf = Buffer.from(data.content, "base64");
  blobCache.set(sha, buf);
  return buf;
}

export async function listVersions(token: string, ref: RepoRef, branch: string, dir: string) {
  const { data } = await client(token).rest.repos.listCommits({
    ...ref,
    sha: branch,
    path: dir || undefined,
    per_page: 50,
  });
  return data.map<Version>((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    author: c.commit.author?.name ?? c.author?.login ?? "Unknown",
    date: c.commit.author?.date ?? "",
  }));
}

export type FileToCommit = { path: string; content: Buffer };

// Writes a set of files under `dir` as a single commit on `branch`.
// In "snapshot" mode, existing files under `dir` that are not in the set are
// removed, so an upload replaces the whole prototype. In "update" mode only
// the given files change, which is what an agent editing one file wants.
export async function commitFiles(
  token: string,
  ref: RepoRef,
  branch: string,
  dir: string,
  files: FileToCommit[],
  message: string,
  mode: "snapshot" | "update" = "snapshot",
  author?: { name: string; email: string },
) {
  const gh = client(token);
  const parent = await headSha(token, ref, branch);
  const { data: parentCommit } = await gh.rest.git.getCommit({ ...ref, commit_sha: parent });

  const prefix = dir ? `${dir}/` : "";
  const existing = await listFiles(token, ref, parentCommit.tree.sha, dir);
  const incoming = new Set(files.map((f) => f.path));

  const tree: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];

  for (const file of files) {
    const { data: blob } = await gh.rest.git.createBlob({
      ...ref,
      content: file.content.toString("base64"),
      encoding: "base64",
    });
    tree.push({ path: prefix + file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  if (mode === "snapshot") {
    for (const old of existing) {
      if (!incoming.has(old.path)) {
        tree.push({ path: prefix + old.path, mode: "100644", type: "blob", sha: null });
      }
    }
  }

  const { data: newTree } = await gh.rest.git.createTree({
    ...ref,
    base_tree: parentCommit.tree.sha,
    tree,
  });
  const { data: commit } = await gh.rest.git.createCommit({
    ...ref,
    message,
    tree: newTree.sha,
    parents: [parent],
    author,
  });
  await gh.rest.git.updateRef({ ...ref, ref: `heads/${branch}`, sha: commit.sha });
  return commit.sha;
}
