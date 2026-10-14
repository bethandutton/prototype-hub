import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { resolveToken } from "@/lib/agent-tokens";
import * as github from "@/lib/github";
import { createGithubProject, getProject, githubToken, listProjects } from "@/lib/projects";

// Rehearsal's MCP server. A person's agent connects with a token made on the
// "Connect your agent" page, and acts inside that person's team.

type Principal = { userId: string; orgId: string; tokenId: string };

const instructions = `Rehearsal is where a team reviews working HTML prototypes together. You are acting for one person in one team.

A project is a folder of plain HTML/CSS/JS in the team's own GitHub repository. Every publish is a commit, so versions are kept and reviewers can switch between them in the browser.

Typical flow:
1. list_projects, then get_project to see the files and the entry file.
2. read_file for anything you need to change.
3. publish_version with only the files you changed and a short message in plain language saying what changed for the reviewer, e.g. "Calmer hero: smaller heading, more space".

Keep prototypes self-contained: relative links, no build step.`;

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function actingUser(userId: string) {
  const user = await (await clerkClient()).users.getUser(userId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Rehearsal user";
  const email = user.primaryEmailAddress?.emailAddress ?? `${userId}@users.rehearsal.app`;
  return { name, email };
}

const handler = createMcpHandler(
  (server) => {
    const who = (ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }) =>
      ctx.http?.authInfo?.extra as Principal;

    server.registerTool(
      "list_projects",
      { title: "List projects", description: "Projects in the team you are acting for.", inputSchema: z.object({}) },
      async (_args, ctx) => {
        const { orgId } = who(ctx);
        const rows = await listProjects(orgId);
        return text(
          rows.map((p) => ({
            id: p.id,
            name: p.name,
            repository: `${p.repoOwner}/${p.repoName}`,
            folder: p.path || "(root)",
            entryFile: p.entryFile,
          })),
        );
      },
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description: "A project's files at its latest version, and where it lives.",
        inputSchema: z.object({ projectId: z.string() }),
      },
      async ({ projectId }, ctx) => {
        const { orgId } = who(ctx);
        const project = await getProject(orgId, projectId);
        if (!project) return fail("No project with that id in your team.");
        const token = await githubToken(orgId);
        const repo = { owner: project.repoOwner, repo: project.repoName };
        const head = await github.headSha(token, repo, project.branch);
        const files = await github.listFiles(token, repo, head, project.path);
        return text({
          id: project.id,
          name: project.name,
          repository: `${project.repoOwner}/${project.repoName}`,
          branch: project.branch,
          folder: project.path || "(root)",
          entryFile: project.entryFile,
          latestVersion: head,
          files: files.map((f) => ({ path: f.path, bytes: f.size })),
        });
      },
    );

    server.registerTool(
      "list_versions",
      {
        title: "List versions",
        description: "Every published version of a project, newest first.",
        inputSchema: z.object({ projectId: z.string() }),
      },
      async ({ projectId }, ctx) => {
        const { orgId } = who(ctx);
        const project = await getProject(orgId, projectId);
        if (!project) return fail("No project with that id in your team.");
        const token = await githubToken(orgId);
        const versions = await github.listVersions(
          token,
          { owner: project.repoOwner, repo: project.repoName },
          project.branch,
          project.path,
        );
        return text(versions);
      },
    );

    server.registerTool(
      "read_file",
      {
        title: "Read file",
        description: "The contents of one file in a project, at the latest version unless a version is given.",
        inputSchema: z.object({
          projectId: z.string(),
          path: z.string().describe("Path relative to the project folder, e.g. index.html"),
          version: z.string().optional().describe("A version id from list_versions"),
        }),
      },
      async ({ projectId, path, version }, ctx) => {
        const { orgId } = who(ctx);
        const project = await getProject(orgId, projectId);
        if (!project) return fail("No project with that id in your team.");
        const token = await githubToken(orgId);
        const repo = { owner: project.repoOwner, repo: project.repoName };
        const sha = version ?? (await github.headSha(token, repo, project.branch));
        const file = (await github.listFiles(token, repo, sha, project.path)).find((f) => f.path === path);
        if (!file) return fail(`No file at ${path} in that version.`);
        return text((await github.readBlob(token, repo, file.sha)).toString("utf8"));
      },
    );

    server.registerTool(
      "publish_version",
      {
        title: "Publish version",
        description:
          "Save changed files as a new version everyone can see. Send only the files you changed; the rest stay as they are. Set replaceAll to true to make these files the entire prototype.",
        inputSchema: z.object({
          projectId: z.string(),
          message: z.string().describe("What changed, for the reviewers, in plain language"),
          files: z.array(z.object({ path: z.string(), content: z.string() })).min(1),
          replaceAll: z.boolean().optional(),
        }),
      },
      async ({ projectId, message, files, replaceAll }, ctx) => {
        const { orgId, userId } = who(ctx);
        const project = await getProject(orgId, projectId);
        if (!project) return fail("No project with that id in your team.");
        const token = await githubToken(orgId);
        const author = await actingUser(userId);
        const sha = await github.commitFiles(
          token,
          { owner: project.repoOwner, repo: project.repoName },
          project.branch,
          project.path,
          files.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: Buffer.from(f.content, "utf8") })),
          message,
          replaceAll ? "snapshot" : "update",
          author,
        );
        return text({ version: sha, message, publishedBy: author.name });
      },
    );

    server.registerTool(
      "create_project",
      {
        title: "Create project",
        description: "Start a new project. A private GitHub repository is created for it in the team's connected account.",
        inputSchema: z.object({ name: z.string().min(1) }),
      },
      async ({ name }, ctx) => {
        const { orgId, userId } = who(ctx);
        try {
          const id = await createGithubProject({ orgId, userId, name, repoMode: "create" });
          return text({ id, name });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "The project couldn't be created.");
        }
      },
    );
  },
  { serverInfo: { name: "rehearsal", version: "0.1.0" }, instructions },
);

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    if (!bearer) return undefined;
    const row = await resolveToken(bearer);
    if (!row) return undefined;
    const extra: Principal = { userId: row.userId, orgId: row.orgId, tokenId: row.id };
    return { token: bearer, clientId: row.id, scopes: [], extra };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
