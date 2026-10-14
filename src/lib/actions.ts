"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTokens, githubConnections, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hashToken, newToken } from "@/lib/agent-tokens";
import { encrypt } from "@/lib/crypto";
import * as github from "@/lib/github";
import { createGithubProject, currentOrg, getProject, githubToken } from "@/lib/projects";

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
  return {};
}

const newProject = z.object({
  name: z.string().trim().min(1, "Give the project a name."),
  repoMode: z.enum(["create", "existing"]),
  repoFullName: z.string().trim().optional(),
  path: z.string().trim().optional(),
});

export async function createProject(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { userId, orgId } = await requireOrg();
  const parsed = newProject.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let id: string;
  try {
    id = await createGithubProject({ orgId, userId, ...parsed.data });
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
  const { orgId } = await requireOrg();
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
  const token = await githubToken(orgId);
  const ref = { owner: project.repoOwner, repo: project.repoName };

  try {
    await github.commitFiles(token, ref, project.branch, project.path, files, message);
  } catch {
    return { error: "The upload couldn't be saved to GitHub. Check the token has write access to the repository." };
  }

  const entryFile = pickEntry(paths, project.entryFile);
  if (entryFile !== project.entryFile) {
    await getDb().update(projects).set({ entryFile }).where(eq(projects.id, project.id));
  }

  revalidatePath(`/projects/${project.id}`);
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
