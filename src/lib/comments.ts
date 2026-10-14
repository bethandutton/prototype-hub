import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments } from "@/db/schema";

export async function listComments(projectId: string) {
  return getDb().select().from(comments).where(eq(comments.projectId, projectId)).orderBy(asc(comments.createdAt));
}
