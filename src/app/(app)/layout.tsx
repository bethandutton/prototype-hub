import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdmin, isSuspended } from "@/lib/admin";
import { agentStatus } from "@/lib/agent-status";
import { colourFor } from "@/lib/people";
import { listProjects } from "@/lib/projects";
import { setupProgress } from "@/lib/setup";
import { SideNav } from "@/components/side-nav";

const statusCopy = {
  none: { label: "Connect your agent", dot: "bg-faint" },
  awaiting: { label: "Awaiting your agent", dot: "bg-faint animate-pulse" },
  connected: { label: "Agent connected", dot: "bg-[#12A594]" },
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const [admin, user] = await Promise.all([isAdmin(), currentUser()]);
  const [status, suspended, setup, projects] = orgId
    ? await Promise.all([agentStatus(orgId, userId), isSuspended(orgId), setupProgress(orgId, userId), listProjects(orgId)])
    : (["none", false, null, []] as const);

  const me = {
    id: userId,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "You",
    colour: colourFor(userId),
  };

  return (
    <div className="flex h-screen">
      <SideNav
        admin={admin}
        orgId={orgId ?? null}
        me={me}
        projects={projects.map((p) => ({ id: p.id, name: p.name, storage: p.storage }))}
        agent={statusCopy[status]}
        setup={setup && !setup.complete ? { done: setup.done, total: setup.total } : null}
        realtime={{
          url: process.env.SUPA_SUPABASE_URL ?? null,
          key: process.env.SUPA_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPA_SUPABASE_ANON_KEY ?? null,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {suspended && !admin ? (
          <main className="mx-auto w-full max-w-[1040px] px-8 pt-24">
            <h1 className="text-4xl">This team&rsquo;s access is paused.</h1>
            <p className="mt-3 max-w-[48ch] text-muted">
              Nothing has been deleted. If you think this is a mistake, get in touch and we&rsquo;ll restore it.
            </p>
          </main>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
