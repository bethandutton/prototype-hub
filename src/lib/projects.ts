import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { githubConnections, projects, type Project } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

// Everything in Rehearsal belongs to an organisation. Pages call this to get
// the current one, or null when the person hasn't picked one yet.
export async function currentOrg() {
  const { userId, orgId } = await auth();
  if (!userId) return null;
  return orgId ? { userId, orgId } : null;
}

export async function listProjects(orgId: string) {
  return getDb().select().from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.createdAt));
}

export async function getProject(orgId: string, id: string): Promise<Project | null> {
  const rows = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, orgId), eq(projects.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGithubConnection(orgId: string) {
  const rows = await getDb().select().from(githubConnections).where(eq(githubConnections.orgId, orgId)).limit(1);
  return rows[0] ?? null;
}

export async function githubToken(orgId: string) {
  const connection = await getGithubConnection(orgId);
  if (!connection) throw new Error("GitHub is not connected for this organisation");
  return decrypt(connection.tokenCiphertext);
}
