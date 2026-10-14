import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens } from "@/db/schema";

// Tokens look like rh_... so they are easy to recognise in an agent's config.
// Only a hash is stored, so a leaked database can't be used to act as anyone.

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return `rh_${randomBytes(24).toString("base64url")}`;
}

export function hashToken(token: string) {
  return hash(token);
}

export async function resolveToken(token: string) {
  if (!token.startsWith("rh_")) return null;
  const rows = await getDb().select().from(agentTokens).where(eq(agentTokens.tokenHash, hash(token))).limit(1);
  const row = rows[0];
  if (!row) return null;
  await getDb().update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, row.id));
  return row;
}
