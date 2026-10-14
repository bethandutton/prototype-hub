import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { isAdmin, isSuspended } from "@/lib/admin";
import { agentStatus } from "@/lib/agent-status";
import { setupProgress } from "@/lib/setup";

const statusCopy = {
  none: { label: "Connect your agent", dot: "bg-faint" },
  awaiting: { label: "Awaiting your agent", dot: "bg-faint animate-pulse" },
  connected: { label: "Agent connected", dot: "bg-[#12A594]" },
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const admin = await isAdmin();
  const [status, suspended, setup] = orgId
    ? await Promise.all([agentStatus(orgId, userId), isSuspended(orgId), setupProgress(orgId, userId)])
    : (["none", false, null] as const);
  const copy = statusCopy[status];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="serif text-xl">
            Rehearsal
          </Link>
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/welcome"
            afterSelectOrganizationUrl="/projects"
            appearance={{ elements: { rootBox: "text-sm" } }}
          />
        </div>
        <div className="flex items-center gap-6 text-sm">
          {setup && !setup.complete && (
            <Link href="/welcome" className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Set up ({setup.done} of {setup.total})
            </Link>
          )}
          <Link
            href="/connect"
            className="flex items-center gap-2 text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            <span className={`inline-block size-2 rounded-full ${copy.dot}`} aria-hidden />
            {copy.label}
          </Link>
          {admin && (
            <Link href="/admin" className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Admin
            </Link>
          )}
          <UserButton />
        </div>
      </header>
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
  );
}
