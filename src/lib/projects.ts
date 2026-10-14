import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { githubConnections, projects, type Project } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import * as github from "@/lib/github";

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

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prototype";
}

// Creates a project backed by GitHub, either in a new private repository or
// an existing one. Used by both the web form and the MCP server.
export async function createGithubProject(input: {
  orgId: string;
  userId: string;
  name: string;
  repoMode: "create" | "existing";
  repoFullName?: string;
  path?: string;
}) {
  const token = await githubToken(input.orgId);
  let repo: { owner: string; repo: string; branch: string };

  try {
    if (input.repoMode === "create") {
      repo = await github.createRepo(token, `rehearsal-${slug(input.name)}`);
    } else {
      const [owner, name] = (input.repoFullName ?? "").split("/");
      if (!owner || !name) throw new Error("Enter the repository as owner/name.");
      repo = await github.getRepo(token, { owner, repo: name });
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Enter ")) throw e;
    throw new Error(
      input.repoMode === "create"
        ? "GitHub couldn't create the repository. The token may need permission to create repositories."
        : "That repository couldn't be found with the connected token.",
    );
  }

  const [created] = await getDb()
    .insert(projects)
    .values({
      orgId: input.orgId,
      name: input.name,
      storage: "github",
      repoOwner: repo.owner,
      repoName: repo.repo,
      branch: repo.branch,
      path: (input.path ?? "").replace(/^\/+|\/+$/g, ""),
      createdBy: input.userId,
    })
    .returning({ id: projects.id });

  return created.id;
}
