"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTokens, comments, githubConnections, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hashToken, newToken } from "@/lib/agent-tokens";
import { encrypt } from "@/lib/crypto";
import * as github from "@/lib/github";
import { createDriveProject, createGithubProject, currentOrg, getProject } from "@/lib/projects";
import { storeFor } from "@/lib/storage";
import { notifyProject } from "@/lib/realtime-server";
import { currentUser } from "@clerk/nextjs/server";

export type ActionResult = { error?: string };

async function requireOrg() {
  const org = await currentOrg();
  if (!org) throw new Error("Choose an organisation first");
  return org;
}

export async function connectGithub(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { userId, orgId } = await requireOrg();
  const token = String(form.get("token") ?? "").trim();
  if (!token) return { error: "Paste a GitHub token to connect." };

  let login: string;
  try {
    ({ login } = await github.whoAmI(token));
  } catch {
    return { error: "GitHub didn't accept that token. Check it and try again." };
  }

  await getDb()
    .insert(githubConnections)
    .values({ orgId, connectedBy: userId, login, tokenCiphertext: encrypt(token) })
    .onConflictDoUpdate({
      target: githubConnections.orgId,
      set: { connectedBy: userId, login, tokenCiphertext: encrypt(token) },
    });

  revalidatePath("/projects/new");
  revalidatePath("/welcome");
  return {};
}

const newProject = z.object({
  name: z.string().trim().min(1, "Give the project a name."),
  storage: z.enum(["github", "google-drive"]).default("github"),
  repoMode: z.enum(["create", "existing"]).default("create"),
  repoFullName: z.string().trim().optional(),
  path: z.string().trim().optional(),
  folder: z.string().trim().optional(),
});

export async function createProject(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { userId, orgId } = await requireOrg();
  const parsed = newProject.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let id: string;
  try {
    const { storage, folder, ...rest } = parsed.data;
    id =
      storage === "google-drive"
        ? await createDriveProject({ orgId, userId, name: rest.name, folder: folder ?? "" })
        : await createGithubProject({ orgId, userId, ...rest });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The project couldn't be created." };
  }
  redirect(`/projects/${id}`);
}

// Files arrive with their path relative to whatever was dropped. If every
// file sits inside one top-level folder, that folder name is dropped so the
// prototype's own files are at the root.
function normalisePaths(paths: string[]) {
  const first = paths[0]?.split("/")[0];
  const shared = paths.length > 0 && paths.every((p) => p.includes("/") && p.split("/")[0] === first);
  return paths.map((p) => (shared ? p.slice(first.length + 1) : p));
}

function pickEntry(paths: string[], fallback: string) {
  if (paths.includes(fallback)) return fallback;
  if (paths.includes("index.html")) return "index.html";
  const html = paths.filter((p) => p.endsWith(".html") || p.endsWith(".htm"));
  return html.length === 1 ? html[0] : fallback;
}

export async function uploadVersion(projectId: string, form: FormData): Promise<ActionResult> {
  const { orgId, userId } = await requireOrg();
  const project = await getProject(orgId, projectId);
  if (!project) return { error: "Project not found." };

  const entries = form.getAll("file").filter((f): f is File => f instanceof File);
  const rawPaths = form.getAll("path").map(String);
  if (entries.length === 0) return { error: "Drop an HTML file or a folder to upload." };

  const paths = normalisePaths(rawPaths);
  const files = await Promise.all(
    entries.map(async (file, i) => ({ path: paths[i], content: Buffer.from(await file.arrayBuffer()) })),
  );

  const message = String(form.get("message") ?? "").trim() || `Upload ${files.length} file${files.length === 1 ? "" : "s"}`;
  const user = await currentUser();
  const author = {
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Rehearsal user",
    email: user?.primaryEmailAddress?.emailAddress ?? `${userId}@users.rehearsal.app`,
  };

  try {
    const store = await storeFor(project);
    await store.write(files, message, "snapshot", author);
  } catch {
    return { error: "The upload couldn't be saved. Check the connected account still has write access." };
  }

  const entryFile = pickEntry(paths, project.entryFile);
  if (entryFile !== project.entryFile) {
    await getDb().update(projects).set({ entryFile }).where(eq(projects.id, project.id));
  }

  revalidatePath(`/projects/${project.id}`);
  await notifyProject(project.id, "versions");
  return {};
}

export type TokenResult = ActionResult & { token?: string; name?: string };

export async function createAgentToken(_prev: TokenResult, form: FormData): Promise<TokenResult> {
  const { userId, orgId } = await requireOrg();
  const name = String(form.get("name") ?? "").trim() || "My agent";
  const token = newToken();
  await getDb().insert(agentTokens).values({ orgId, userId, name, tokenHash: hashToken(token) });
  revalidatePath("/connect");
  return { token, name };
}

export async function revokeAgentToken(id: string) {
  const { userId, orgId } = await requireOrg();
  await getDb()
    .delete(agentTokens)
    .where(and(eq(agentTokens.id, id), eq(agentTokens.orgId, orgId), eq(agentTokens.userId, userId)));
  revalidatePath("/connect");
}

const newComment = z.object({
  element: z.string().min(1),
  elementLabel: z.string().min(1),
  version: z.string().min(1),
  body: z.string().trim().min(1, "Write something first."),
});

export async function addComment(projectId: string, input: z.infer<typeof newComment>): Promise<ActionResult> {
  const { userId, orgId } = await requireOrg();
  const parsed = newComment.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const project = await getProject(orgId, projectId);
  if (!project) return { error: "Project not found." };

  const user = await currentUser();
  const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Someone";

  await getDb().insert(comments).values({ projectId, orgId, authorId: userId, authorName, ...parsed.data });
  revalidatePath(`/projects/${projectId}`);
  await notifyProject(projectId, "comments");
  return {};
}

export async function setCommentResolved(commentId: string, resolved: boolean) {
  const { orgId } = await requireOrg();
  const [row] = await getDb()
    .update(comments)
    .set({ resolvedAt: resolved ? new Date() : null })
    .where(and(eq(comments.id, commentId), eq(comments.orgId, orgId)))
    .returning({ projectId: comments.projectId });
  if (row) {
    revalidatePath(`/projects/${row.projectId}`);
    await notifyProject(row.projectId, "comments");
  }
}
