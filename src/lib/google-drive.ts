// Google Drive as a place for prototype files. Rehearsal connects once per
// team with OAuth, then reads and writes the folder a project points at.
// Drive keeps a revision per file, which is what versions are built from.

const scopes = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/userinfo.email"];

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google: ${json.error ?? res.status}`);
  return json;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!tokens.refresh_token) throw new Error("Google didn't return a refresh token");
  const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json() as Promise<{ email?: string }>);
  return { refreshToken: tokens.refresh_token, email: me.email ?? "unknown" };
}

// Access tokens last an hour; cache them per refresh token for the life of
// the server instance.
const accessCache = new Map<string, { token: string; exp: number }>();

export async function accessToken(refreshToken: string) {
  const cached = accessCache.get(refreshToken);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  accessCache.set(refreshToken, { token: tokens.access_token!, exp: Date.now() + (tokens.expires_in ?? 3600) * 1000 });
  return tokens.access_token!;
}

const api = "https://www.googleapis.com/drive/v3";
const upload = "https://www.googleapis.com/upload/drive/v3";
const drives = "supportsAllDrives=true";
const folderType = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name: string; mimeType: string; size?: string; headRevisionId?: string };

async function gfetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Google Drive ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function getFolder(token: string, id: string) {
  const res = await gfetch(token, `${api}/files/${id}?fields=id,name,mimeType&${drives}`);
  const file = (await res.json()) as DriveFile;
  if (file.mimeType !== folderType) throw new Error("That link isn't a folder");
  return { id: file.id, name: file.name };
}

// Turns a pasted Drive link or id into a folder id.
export function folderIdFrom(input: string) {
  const m = input.match(/folders\/([A-Za-z0-9_-]+)/) ?? input.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return (m?.[1] ?? input.trim()).replace(/[^A-Za-z0-9_-]/g, "");
}

async function children(token: string, folderId: string) {
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size,headRevisionId)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const json = (await (await gfetch(token, `${api}/files?${params}`)).json()) as {
      files: DriveFile[];
      nextPageToken?: string;
    };
    out.push(...json.files);
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export type LiveFile = { path: string; fileId: string; revisionId: string; size: number };

// Every file under the folder, with paths relative to it.
export async function walk(token: string, folderId: string, prefix = ""): Promise<LiveFile[]> {
  const items = await children(token, folderId);
  const files: LiveFile[] = [];
  for (const item of items) {
    if (item.mimeType === folderType) {
      files.push(...(await walk(token, item.id, `${prefix}${item.name}/`)));
    } else if (item.headRevisionId) {
      files.push({ path: prefix + item.name, fileId: item.id, revisionId: item.headRevisionId, size: Number(item.size ?? 0) });
    }
  }
  return files;
}

export async function download(token: string, fileId: string, revisionId?: string) {
  const url = revisionId
    ? `${api}/files/${fileId}/revisions/${revisionId}?alt=media`
    : `${api}/files/${fileId}?alt=media&${drives}`;
  return Buffer.from(await (await gfetch(token, url)).arrayBuffer());
}

async function ensureFolder(token: string, parentId: string, name: string) {
  const existing = (await children(token, parentId)).find((f) => f.name === name && f.mimeType === folderType);
  if (existing) return existing.id;
  const res = await gfetch(token, `${api}/files?${drives}&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: folderType, parents: [parentId] }),
  });
  return ((await res.json()) as { id: string }).id;
}

function mime(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

// Writes one file, creating subfolders as needed and keeping the revision so
// older versions stay readable. Returns the file's new revision.
export async function writeFile(
  token: string,
  rootId: string,
  live: LiveFile[],
  path: string,
  content: Buffer,
): Promise<LiveFile> {
  const existing = live.find((f) => f.path === path);
  const fields = "id,headRevisionId,size";
  if (existing) {
    const res = await gfetch(
      token,
      `${upload}/files/${existing.fileId}?uploadType=media&keepRevisionForever=true&${drives}&fields=${fields}`,
      { method: "PATCH", headers: { "Content-Type": mime(path) }, body: new Uint8Array(content) },
    );
    const f = (await res.json()) as DriveFile;
    return { path, fileId: f.id, revisionId: f.headRevisionId!, size: Number(f.size ?? content.length) };
  }

  const parts = path.split("/");
  const name = parts.pop()!;
  let parent = rootId;
  for (const dir of parts) parent = await ensureFolder(token, parent, dir);

  const boundary = "rehearsal-" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime(path)}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await gfetch(
    token,
    `${upload}/files?uploadType=multipart&keepRevisionForever=true&${drives}&fields=${fields}`,
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: new Uint8Array(body) },
  );
  const f = (await res.json()) as DriveFile;
  return { path, fileId: f.id, revisionId: f.headRevisionId!, size: Number(f.size ?? content.length) };
}

export async function trash(token: string, fileId: string) {
  await gfetch(token, `${api}/files/${fileId}?${drives}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}
