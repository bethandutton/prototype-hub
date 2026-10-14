import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { resolveToken } from "@/lib/agent-tokens";
import * as github from "@/lib/github";
import { createGithubProject, getDriveConnection, getGithubConnection, getProject, listProjects, locationOf } from "@/lib/projects";
import { storeFor } from "@/lib/storage";
import { listComments } from "@/lib/comments";
import { comments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { githubConnections } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { notifyProject } from "@/lib/realtime-server";

// Rehearsal's MCP server. A person's agent connects with a token made on the
// "Connect your agent" page, and acts inside that person's team.

type Principal = { userId: string; orgId: string; tokenId: string };

const instructions = `Rehearsal is where a team reviews working HTML prototypes together. You are acting for one person in one team.

A project is a folder of plain HTML/CSS/JS in the team's own GitHub repository. Every publish is a commit, so versions are kept and reviewers can switch between them in the browser.

Typical flow:
1. list_projects, then get_project to see the files and the entry file.
2. list_comments to see what reviewers have asked for. Each comment names the element it is pinned to (a CSS path) in the version it was written on.
3. read_file for anything you need to change.
4. publish_version with only the files you changed and a short message in plain language saying what changed for the reviewer, e.g. "Calmer hero: smaller heading, more space".
5. resolve_comment for each comment you addressed.

Keep prototypes self-contained: relative links, no build step.

If a tool says GitHub is not connected for the team, and the GitHub CLI on this machine is signed in, run \`gh auth token\` and pass the result to connect_github. Otherwise ask the person to connect GitHub in Rehearsal.`;

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
          rows.map((p) => ({ id: p.id, name: p.name, storage: p.storage, location: locationOf(p), entryFile: p.entryFile })),
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
        const store = await storeFor(project);
        const head = await store.head();
        const files = await store.listFiles(head);
        return text({
          id: project.id,
          name: project.name,
          storage: project.storage,
          location: locationOf(project),
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
        return text(await (await storeFor(project)).listVersions());
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
        const content = await (await storeFor(project)).readFile(version ?? "head", path);
        if (!content) return fail(`No file at ${path} in that version.`);
        return text(content.toString("utf8"));
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
        const author = await actingUser(userId);
        const store = await storeFor(project);
        const version = await store.write(
          files.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: Buffer.from(f.content, "utf8") })),
          message,
          replaceAll ? "snapshot" : "update",
          author,
        );
        await notifyProject(project.id, "versions");
        return text({ version, message, publishedBy: author.name });
      },
    );

    server.registerTool(
      "list_comments",
      {
        title: "List comments",
        description: "Reviewers' comments on a project, each pinned to an element of the prototype. Open ones first.",
        inputSchema: z.object({ projectId: z.string(), includeResolved: z.boolean().optional() }),
      },
      async ({ projectId, includeResolved }, ctx) => {
        const { orgId } = who(ctx);
        const project = await getProject(orgId, projectId);
        if (!project) return fail("No project with that id in your team.");
        const rows = (await listComments(project.id)).filter((c) => includeResolved || !c.resolvedAt);
        return text(
          rows.map((c) => ({
            id: c.id,
            by: c.authorName,
            at: c.createdAt.toISOString(),
            element: c.element,
            elementLabel: c.elementLabel,
            version: c.version,
            comment: c.body,
            resolved: Boolean(c.resolvedAt),
          })),
        );
      },
    );

    server.registerTool(
      "resolve_comment",
      {
        title: "Resolve comment",
        description: "Mark a comment as dealt with, usually right after publishing the version that addresses it.",
        inputSchema: z.object({ commentId: z.string() }),
      },
      async ({ commentId }, ctx) => {
        const { orgId } = who(ctx);
        const [row] = await getDb()
          .update(comments)
          .set({ resolvedAt: new Date() })
          .where(and(eq(comments.id, commentId), eq(comments.orgId, orgId)))
          .returning({ projectId: comments.projectId });
        if (!row) return fail("No comment with that id in your team.");
        await notifyProject(row.projectId, "comments");
        return text({ resolved: true });
      },
    );

    server.registerTool(
      "connect_github",
      {
        title: "Connect GitHub",
        description:
          "Connect the team's GitHub account so projects can be stored there. Pass a GitHub token with repo access, for example the output of `gh auth token`.",
        inputSchema: z.object({ token: z.string().min(1) }),
      },
      async ({ token }, ctx) => {
        const { orgId, userId } = who(ctx);
        let login: string;
        try {
          ({ login } = await github.whoAmI(token));
        } catch {
          return fail("GitHub didn't accept that token.");
        }
        await getDb()
          .insert(githubConnections)
          .values({ orgId, connectedBy: userId, login, tokenCiphertext: encrypt(token) })
          .onConflictDoUpdate({
            target: githubConnections.orgId,
            set: { connectedBy: userId, login, tokenCiphertext: encrypt(token) },
          });
        return text({ connected: true, login });
      },
    );

    server.registerTool(
      "status",
      {
        title: "Status",
        description: "Whether the team has GitHub connected and how many projects exist.",
        inputSchema: z.object({}),
      },
      async (_args, ctx) => {
        const { orgId } = who(ctx);
        const [connection, driveConnection, rows] = await Promise.all([
          getGithubConnection(orgId),
          getDriveConnection(orgId),
          listProjects(orgId),
        ]);
        return text({
          githubConnected: Boolean(connection),
          githubLogin: connection?.login ?? null,
          googleDriveConnected: Boolean(driveConnection),
          googleDriveAccount: driveConnection?.email ?? null,
          projects: rows.length,
        });
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
