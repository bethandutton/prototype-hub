import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { driveConnections, githubConnections, projects, type Project } from "@/db/schema";
import * as drive from "@/lib/google-drive";
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

export async function getDriveConnection(orgId: string) {
  const rows = await getDb().select().from(driveConnections).where(eq(driveConnections.orgId, orgId)).limit(1);
  return rows[0] ?? null;
}

export async function driveAccessToken(orgId: string) {
  const connection = await getDriveConnection(orgId);
  if (!connection) throw new Error("Google Drive is not connected for this organisation");
  return drive.accessToken(decrypt(connection.refreshTokenCiphertext));
}

// Where a project's files are, in words people recognise.
export function locationOf(project: Project) {
  if (project.storage === "google-drive") return "Google Drive";
  return `${project.repoOwner}/${project.repoName}${project.path ? `/${project.path}` : ""}`;
}

// Creates a project that points at a Drive folder the person pasted a link to.
export async function createDriveProject(input: { orgId: string; userId: string; name: string; folder: string }) {
  const token = await driveAccessToken(input.orgId);
  const id = drive.folderIdFrom(input.folder);
  if (!id) throw new Error("Paste the link to a Google Drive folder.");
  let folder: { id: string; name: string };
  try {
    folder = await drive.getFolder(token, id);
  } catch {
    throw new Error("That folder couldn't be opened with the connected Google account. Check the link and that the account can see it.");
  }
  const [created] = await getDb()
    .insert(projects)
    .values({ orgId: input.orgId, name: input.name, storage: "google-drive", driveFolderId: folder.id, createdBy: input.userId })
    .returning({ id: projects.id });
  return created.id;
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
