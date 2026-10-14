"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orgSettings, plans, type Plan } from "@/db/schema";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Admins only");
}

export async function setPlan(orgId: string, plan: Plan) {
  await requireAdmin();
  if (!plans.includes(plan)) throw new Error("Unknown plan");
  await getDb()
    .insert(orgSettings)
    .values({ orgId, plan })
    .onConflictDoUpdate({ target: orgSettings.orgId, set: { plan, updatedAt: new Date() } });
  revalidatePath("/admin");
}

export async function setTeamSuspended(orgId: string, suspended: boolean) {
  await requireAdmin();
  const suspendedAt = suspended ? new Date() : null;
  await getDb()
    .insert(orgSettings)
    .values({ orgId, suspendedAt })
    .onConflictDoUpdate({ target: orgSettings.orgId, set: { suspendedAt, updatedAt: new Date() } });
  revalidatePath("/admin");
}

export async function setPersonBanned(userId: string, banned: boolean) {
  await requireAdmin();
  const clerk = await clerkClient();
  if (banned) await clerk.users.banUser(userId);
  else await clerk.users.unbanUser(userId);
  revalidatePath("/admin");
}
