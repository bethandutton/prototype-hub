import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens, projects } from "@/db/schema";
import { getDriveConnection, getGithubConnection } from "@/lib/projects";

export type SetupProgress = {
  storage: boolean;
  agent: boolean;
  project: boolean;
  done: number;
  total: number;
  complete: boolean;
};

// The three things a team needs before Rehearsal is useful: somewhere for
// files to live, an agent that can reach it, and a first prototype.
export async function setupProgress(orgId: string, userId: string): Promise<SetupProgress> {
  const [connection, driveConnection, usedTokens, anyProject] = await Promise.all([
    getGithubConnection(orgId),
    getDriveConnection(orgId),
    getDb()
      .select({ id: agentTokens.id })
      .from(agentTokens)
      .where(and(eq(agentTokens.orgId, orgId), eq(agentTokens.userId, userId), isNotNull(agentTokens.lastUsedAt)))
      .limit(1),
    getDb().select({ id: projects.id }).from(projects).where(eq(projects.orgId, orgId)).limit(1),
  ]);
  const storage = Boolean(connection || driveConnection);
  const agent = usedTokens.length > 0;
  const project = anyProject.length > 0;
  const done = [storage, agent, project].filter(Boolean).length;
  return { storage, agent, project, done, total: 3, complete: done === 3 };
}
