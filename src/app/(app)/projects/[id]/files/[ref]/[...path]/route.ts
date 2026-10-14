import { NextResponse } from "next/server";
import * as github from "@/lib/github";
import { currentOrg, getProject, githubToken } from "@/lib/projects";

const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

// The helper script lets Rehearsal see what the pointer is over inside the
// sandboxed frame. It is added to every HTML file as it is served.
function withHelper(html: string) {
  const tag = '<script src="/frame-helper.js"></script>';
  return html.includes("</head>") ? html.replace("</head>", `${tag}</head>`) : tag + html;
}

type Params = { params: Promise<{ id: string; ref: string; path: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, ref, path } = await params;
  const org = await currentOrg();
  if (!org) return new NextResponse("Not signed in", { status: 401 });

  const project = await getProject(org.orgId, id);
  if (!project) return new NextResponse("Not found", { status: 404 });

  const token = await githubToken(org.orgId);
  const repo = { owner: project.repoOwner, repo: project.repoName };
  const sha = ref === "head" ? await github.headSha(token, repo, project.branch) : ref;

  const filePath = path.join("/");
  const files = await github.listFiles(token, repo, sha, project.path);
  const file = files.find((f) => f.path === filePath);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const type = types[ext] ?? "application/octet-stream";
  let body: Buffer | string = await github.readBlob(token, repo, file.sha);
  if (ext === "html" || ext === "htm") body = withHelper(body.toString("utf8"));

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": type,
      // A commit never changes, so its files can be cached by the browser.
      "Cache-Control": ref === "head" ? "private, no-cache" : "private, max-age=31536000, immutable",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
