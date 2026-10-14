import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens } from "@/db/schema";

export type AgentStatus = "none" | "awaiting" | "connected";

// An agent counts as connected if one of this person's tokens was used in the
// last ten minutes; tokens that exist but were never used are "awaiting".
export async function agentStatus(orgId: string, userId: string): Promise<AgentStatus> {
  const rows = await getDb()
    .select({ lastUsedAt: agentTokens.lastUsedAt })
    .from(agentTokens)
    .where(and(eq(agentTokens.orgId, orgId), eq(agentTokens.userId, userId)))
    .orderBy(desc(agentTokens.lastUsedAt));
  if (rows.length === 0) return "none";
  return usedRecently(rows[0].lastUsedAt) ? "connected" : "awaiting";
}

export function usedRecently(lastUsedAt: Date | null) {
  return Boolean(lastUsedAt && Date.now() - lastUsedAt.getTime() < 10 * 60 * 1000);
}
