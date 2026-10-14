import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orgSettings, type Plan } from "@/db/schema";

// Bethan is the admin. ADMIN_EMAILS can add more (comma-separated), which
// also lets a test account reach the admin area locally.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "bethandutton@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export async function isAdmin() {
  const user = await currentUser();
  return Boolean(user?.emailAddresses.some((e) => adminEmails.has(e.emailAddress.toLowerCase())));
}

export async function settingsFor(orgId: string) {
  const rows = await getDb().select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1);
  return rows[0] ?? { orgId, plan: "free" as Plan, suspendedAt: null, updatedAt: new Date() };
}

export async function isSuspended(orgId: string) {
  return Boolean((await settingsFor(orgId)).suspendedAt);
}

export type AdminTeam = {
  id: string;
  name: string;
  members: number;
  createdAt: Date;
  plan: Plan;
  suspendedAt: Date | null;
};

export type AdminPerson = {
  id: string;
  name: string;
  email: string;
  lastActiveAt: Date | null;
  banned: boolean;
  teams: string[];
};

export async function adminOverview(): Promise<{ teams: AdminTeam[]; people: AdminPerson[] }> {
  const clerk = await clerkClient();
  const [orgs, users, settings] = await Promise.all([
    clerk.organizations.getOrganizationList({ limit: 200, includeMembersCount: true }),
    clerk.users.getUserList({ limit: 200, orderBy: "-created_at" }),
    getDb().select().from(orgSettings),
  ]);
  const byOrg = new Map(settings.map((s) => [s.orgId, s]));

  const teams = orgs.data.map<AdminTeam>((o) => ({
    id: o.id,
    name: o.name,
    members: o.membersCount ?? 0,
    createdAt: new Date(o.createdAt),
    plan: byOrg.get(o.id)?.plan ?? "free",
    suspendedAt: byOrg.get(o.id)?.suspendedAt ?? null,
  }));

  const people = await Promise.all(
    users.data.map(async (u) => {
      const memberships = await clerk.users.getOrganizationMembershipList({ userId: u.id, limit: 50 });
      return {
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Unnamed",
        email: u.primaryEmailAddress?.emailAddress ?? "",
        lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt) : null,
        banned: u.banned,
        teams: memberships.data.map((m) => m.organization.name),
      } satisfies AdminPerson;
    }),
  );

  return { teams, people };
}
