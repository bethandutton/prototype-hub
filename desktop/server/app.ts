import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { Store } from "../core/store";
import { injectHelper } from "../core/html";
import { readDesignLibrary } from "../core/library";
import { createMcpServer } from "./mcp";
import type { Mode, Prototype, ResourceLink } from "../core/types";

// One local server does everything the app needs: the app's own API, the
// prototype files for the sandboxed frame, a stream of changes on disk, and
// the MCP endpoint agents connect to over HTTP.

export const DEFAULT_PORT = 4848;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function mime(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AppServerOptions {
  store: Store;
  // Folder holding the built renderer (index.html and assets).
  uiDir: string;
  // Folder holding frame-helper.js.
  publicDir: string;
  skillFile: string;
  stdioEntry: string;
  port?: number;
}

export interface AppServer {
  port: number;
  url: string;
  close(): Promise<void>;
  notify(event: { type: string; prototypeId?: string; workspaceId?: string }): void;
}

export async function startAppServer(opts: AppServerOptions): Promise<AppServer> {
  const { store } = opts;
  const clients = new Set<http.ServerResponse>();
  const protoCache = new Map<string, Prototype>();

  const notify = (event: { type: string; prototypeId?: string; workspaceId?: string }) => {
    protoCache.clear();
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(line);
  };

  // Changes on disk, whether made by an agent, by a sync folder or by the
  // other person sharing it, nudge every open window to refresh.
  const watchers = new Map<string, fs.FSWatcher>();
  let pending: NodeJS.Timeout | null = null;
  const watchWorkspaces = () => {
    for (const ws of store.listWorkspaces()) {
      if (watchers.has(ws.path) || !fs.existsSync(ws.path)) continue;
      try {
        const w = fs.watch(ws.path, { recursive: true }, (_e, name) => {
          if (typeof name === "string" && name.endsWith(".tmp")) return;
          if (pending) clearTimeout(pending);
          pending = setTimeout(() => notify({ type: "disk", workspaceId: ws.id }), 250);
        });
        w.on("error", () => watchers.delete(ws.path));
        watchers.set(ws.path, w);
      } catch {
        // A folder that cannot be watched is still readable; it just will not refresh live.
      }
    }
  };
  watchWorkspaces();

  const findPrototype = (id: string) => {
    let p = protoCache.get(id);
    if (!p) {
      p = store.findPrototype(id);
      if (p) protoCache.set(id, p);
    }
    return p;
  };

  const json = (res: http.ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(data));
  };

  const readBody = (req: http.IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });

  const readJsonBody = async (req: http.IncomingMessage) => {
    const raw = await readBody(req);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new HttpError(400, "The request body is not JSON.");
    }
  };

  const serveFile = (res: http.ServerResponse, file: string, transform?: (text: string) => string) => {
    let data: Buffer;
    try {
      data = fs.readFileSync(file);
    } catch {
      throw new HttpError(404, "Not found.");
    }
    const type = mime(file);
    if (transform && type.startsWith("text/html")) {
      const out = transform(data.toString("utf8"));
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(out);
      return;
    }
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(data);
  };

  const connectionInfo = (port: number) => ({
    port,
    httpUrl: `http://127.0.0.1:${port}/mcp`,
    stdioCommand: `node ${opts.stdioEntry}`,
    skillFile: opts.skillFile,
    claude: {
      http: `claude mcp add --transport http rehearsal http://127.0.0.1:${port}/mcp`,
      stdio: `claude mcp add rehearsal -- node ${opts.stdioEntry}`,
    },
    json: { mcpServers: { rehearsal: { command: "node", args: [opts.stdioEntry] } } },
  });

  const api = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL, port: number) => {
    const m = req.method ?? "GET";
    const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const [head, id, sub, subId, action] = parts;

    if (head === "me" && m === "GET") return json(res, 200, { name: store.me(), set: Boolean(store.settings().name) });
    if (head === "me" && m === "PUT") {
      const body = await readJsonBody(req);
      return json(res, 200, store.setSettings({ name: String(body.name ?? "").trim() }));
    }
    if (head === "connection") return json(res, 200, connectionInfo(port));
    if (head === "skill") return json(res, 200, { file: opts.skillFile, content: fs.readFileSync(opts.skillFile, "utf8") });

    if (head === "workspaces") {
      if (!id) {
        if (m === "GET") return json(res, 200, store.listWorkspaces());
        if (m === "POST") {
          const body = await readJsonBody(req);
          const ws = store.addWorkspace({ name: String(body.name ?? ""), path: String(body.path ?? "") });
          watchWorkspaces();
          notify({ type: "workspaces" });
          return json(res, 201, ws);
        }
      } else {
        if (!sub && m === "GET") {
          const ws = store.getWorkspace(id);
          if (!ws) throw new HttpError(404, "No such workspace.");
          return json(res, 200, ws);
        }
        if (!sub && m === "PATCH") {
          const body = await readJsonBody(req);
          const patch: Record<string, unknown> = {};
          if ("name" in body) patch.name = String(body.name);
          if ("designLibraryRepo" in body) patch.designLibraryRepo = String(body.designLibraryRepo ?? "");
          const ws = store.updateWorkspace(id, patch);
          notify({ type: "workspaces" });
          return json(res, 200, ws);
        }
        if (!sub && m === "DELETE") {
          store.removeWorkspace(id);
          notify({ type: "workspaces" });
          return json(res, 200, { removed: true });
        }
        if (sub === "tree" && m === "GET") return json(res, 200, store.tree(id));
        if (sub === "library" && m === "GET") {
          const ws = store.getWorkspace(id);
          if (!ws) throw new HttpError(404, "No such workspace.");
          return json(res, 200, ws.designLibraryRepo ? readDesignLibrary(ws.designLibraryRepo) : null);
        }
        if (sub === "folders" && m === "POST") {
          const body = await readJsonBody(req);
          const folder = store.createFolder(id, String(body.parent ?? ""), String(body.name ?? ""));
          notify({ type: "prototypes", workspaceId: id });
          return json(res, 201, folder);
        }
        if (sub === "prototypes" && m === "POST") {
          const body = await readJsonBody(req);
          const proto = store.createPrototype(id, {
            folder: String(body.folder ?? ""),
            title: String(body.title ?? ""),
            description: String(body.description ?? ""),
            mode: (body.mode as Mode) ?? "wireframe",
            html: String(body.html ?? "<!doctype html><html><body></body></html>"),
            resourceLinks: (body.resourceLinks as ResourceLink[]) ?? [],
            files: (body.files as { path: string; content: string }[]) ?? [],
          });
          notify({ type: "prototypes", workspaceId: id });
          return json(res, 201, proto);
        }
      }
    }

    if (head === "prototypes" && id) {
      const proto = findPrototype(id);
      if (!proto) throw new HttpError(404, "No such prototype.");
      if (!sub && m === "GET") {
        return json(res, 200, {
          prototype: proto,
          blockMap: store.blockMap(proto),
          blocks: store.blocks(proto),
          comments: store.comments(proto),
          versions: store.pageVersions(proto),
          decisions: store.decisions(proto),
          insights: store.insightLinks(proto),
          files: store.listFiles(proto),
        });
      }
      if (!sub && m === "PATCH") {
        const body = await readJsonBody(req);
        const patch: Record<string, unknown> = {};
        for (const k of ["title", "description", "mode", "resourceLinks"]) if (k in body) patch[k] = body[k];
        const next = store.updatePrototype(id, patch);
        notify({ type: "prototypes", workspaceId: proto.workspaceId, prototypeId: id });
        return json(res, 200, next);
      }
      if (sub === "html" && m === "PUT") {
        const body = await readJsonBody(req);
        const v = store.updateHtml(id, { html: String(body.html ?? ""), message: String(body.message ?? "Edited"), rationale: String(body.rationale ?? "") });
        notify({ type: "versions", prototypeId: id });
        return json(res, 200, v);
      }
      if (sub === "blocks" && subId && action === "versions" && m === "POST") {
        const body = await readJsonBody(req);
        const r = store.proposeBlockVersion(id, { blockId: subId, content: String(body.content ?? ""), rationale: String(body.rationale ?? ""), source: "human", select: Boolean(body.select) });
        notify({ type: "blocks", prototypeId: id });
        return json(res, 201, r);
      }
      if (sub === "blocks" && subId && action === "select" && m === "POST") {
        const body = await readJsonBody(req);
        const block = store.selectBlockVersion(id, { blockId: subId, versionId: String(body.versionId ?? "") });
        notify({ type: "blocks", prototypeId: id });
        return json(res, 200, block);
      }
      if (sub === "comments" && !subId && m === "POST") {
        const body = await readJsonBody(req);
        const c = store.addComment(id, { body: String(body.body ?? ""), blockId: body.blockId ? String(body.blockId) : null, parentId: body.parentId ? String(body.parentId) : null });
        notify({ type: "comments", prototypeId: id });
        return json(res, 201, c);
      }
      if (sub === "comments" && subId && action === "resolve" && m === "POST") {
        const body = await readJsonBody(req);
        const c = store.resolveComment(id, subId, body.resolved !== false);
        notify({ type: "comments", prototypeId: id });
        return json(res, 200, c);
      }
      if (sub === "insights" && m === "POST") {
        const body = await readJsonBody(req);
        const l = store.addInsightLink(id, { blockId: body.blockId ? String(body.blockId) : null, query: String(body.query ?? "") });
        notify({ type: "insights", prototypeId: id });
        return json(res, 201, l);
      }
    }

    throw new HttpError(404, "No such route.");
  };

  // Prototype files, served at /p/<id>/<file>. The entry file gets the frame
  // helper added so the app can see hovers, clicks and draw overlays. A page
  // version can be previewed at the same path with ?v=<versionId>.
  const prototypeFile = (res: http.ServerResponse, url: URL) => {
    const [, , id, ...rest] = url.pathname.split("/");
    const proto = findPrototype(id);
    if (!proto) throw new HttpError(404, "No such prototype.");
    const rel = decodeURIComponent(rest.join("/")) || proto.entry;
    const isEntry = rel === proto.entry;
    const version = url.searchParams.get("v");
    if (isEntry && version) {
      const html = store.pageVersionHtml(proto, version);
      if (html === null) throw new HttpError(404, "No such version.");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      return res.end(injectHelper(html, "/frame-helper.js"));
    }
    const data = store.readFile(proto, rel);
    if (!data) throw new HttpError(404, "Not found.");
    const type = mime(rel);
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(isEntry || type.startsWith("text/html") ? injectHelper(data.toString("utf8"), "/frame-helper.js") : data);
  };

  // MCP over HTTP: a fresh server and transport per request, so there is no
  // session state to lose when the app restarts.
  const mcp = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
    const request = new Request(url.toString(), { method: req.method, headers, body });
    const server = createMcpServer(store, notify);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (response.body) Readable.fromWeb(response.body as import("stream/web").ReadableStream).pipe(res);
    else res.end();
    res.on("close", () => void server.close().catch(() => {}));
  };

  const events = (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(res);
    });
  };

  const ui = (res: http.ServerResponse, url: URL) => {
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = path.resolve(opts.uiDir, rel);
    if (!file.startsWith(path.resolve(opts.uiDir))) throw new HttpError(403, "Forbidden.");
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file);
    const index = path.join(opts.uiDir, "index.html");
    if (!fs.existsSync(index)) throw new HttpError(503, "The app has not been built yet. Run pnpm build in desktop/.");
    serveFile(res, index);
  };

  let port = opts.port ?? DEFAULT_PORT;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    try {
      // Only the app itself and local agents talk to this server.
      const host = req.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) throw new HttpError(403, "Local only.");
      if (url.pathname === "/mcp") return await mcp(req, res, url);
      if (url.pathname === "/events") return events(req, res);
      if (url.pathname === "/frame-helper.js") return serveFile(res, path.join(opts.publicDir, "frame-helper.js"));
      if (url.pathname.startsWith("/api/")) return await api(req, res, url, port);
      if (url.pathname.startsWith("/p/")) return prototypeFile(res, url);
      return ui(res, url);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof Error ? e.message : String(e);
      if (!res.headersSent) json(res, status, { error: message });
      else res.end();
    }
  });

  port = await new Promise<number>((resolve, reject) => {
    const tryListen = (p: number) => {
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && p !== 0) tryListen(0);
        else reject(err);
      });
      server.listen(p, "127.0.0.1", () => {
        server.removeAllListeners("error");
        resolve((server.address() as { port: number }).port);
      });
    };
    tryListen(port);
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    notify,
    close: () =>
      new Promise<void>((resolve) => {
        for (const w of watchers.values()) w.close();
        for (const c of clients) c.end();
        server.close(() => resolve());
      }),
  };
}
