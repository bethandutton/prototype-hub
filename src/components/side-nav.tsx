"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { StorageKind } from "@/db/schema";
import type { Person } from "@/lib/people";
import { useTeamPresence } from "@/lib/realtime";
import { SourceIcon } from "@/components/source-icon";

// The left-hand navigation: wordmark, team, the project tree with who is on
// each one right now, agent status, and the person at the bottom. Admin
// lives in the person's menu so the chrome is the same for everyone.

type Props = {
  admin: boolean;
  orgId: string | null;
  me: Person;
  projects: { id: string; name: string; storage: StorageKind }[];
  agent: { label: string; dot: string };
  setup: { done: number; total: number } | null;
  realtime: { url: string | null; key: string | null };
};

export function SideNav({ admin, orgId, me, projects, agent, setup, realtime }: Props) {
  const pathname = usePathname();
  const currentProject = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;
  const onProject = useTeamPresence({
    orgId,
    me,
    projectId: currentProject && currentProject !== "new" ? currentProject : null,
    supabaseUrl: realtime.url,
    supabaseKey: realtime.key,
  });
  const tone = (isActive: boolean) => (isActive ? "text-ink" : "text-muted hover:text-ink");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-hairline">
      <Link href="/projects" className="serif px-5 pt-5 text-xl">
        Rehearsal
      </Link>
      <div className="mt-5 px-3">
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/welcome"
          afterSelectOrganizationUrl="/projects"
          appearance={{
            elements: {
              rootBox: "w-full text-sm",
              organizationSwitcherTrigger: "w-full justify-between px-2 py-1.5",
              organizationPreviewAvatarBox: "size-5 rounded-sm",
            },
          }}
        />
      </div>

      <nav className="mt-6 flex min-h-0 flex-1 flex-col text-sm">
        {setup && (
          <Link href="/welcome" className={`px-5 py-1.5 ${tone(pathname === "/welcome")}`}>
            Set up
            <span className="ml-2 text-faint">
              {setup.done} of {setup.total}
            </span>
          </Link>
        )}
        <div className="mt-2 flex items-center justify-between pr-3 pl-5">
          <Link href="/projects" className={`py-1.5 ${tone(pathname === "/projects")}`}>
            Projects
          </Link>
          <Link
            href="/projects/new"
            aria-label="Add a project"
            title="Add a project"
            className="flex size-6 items-center justify-center rounded text-muted hover:bg-stage hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path d="M7 2v10M2 7h10" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
          {projects.map((p) => {
            const here = onProject[p.id] ?? [];
            const isActive = currentProject === p.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`flex items-center gap-2 py-1.5 pr-3 pl-5 ${tone(isActive)}`}
                  title={here.length ? `${p.name}: ${here.map((h) => h.name).join(", ")} here` : p.name}
                >
                  <SourceIcon kind={p.storage} className={`size-3.5 shrink-0 ${isActive ? "text-ink" : "text-faint"}`} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {here.length > 0 && (
                    <span className="flex shrink-0 items-center -space-x-1" aria-label={`${here.length} here`}>
                      {here.slice(0, 3).map((h) => (
                        <span
                          key={h.id}
                          className="block size-2.5 rounded-full ring-2 ring-white"
                          style={{ background: h.colour }}
                        />
                      ))}
                      {here.length > 3 && <span className="pl-2 text-xs text-faint">+{here.length - 3}</span>}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-3 border-t border-hairline px-3 pt-3 pb-4">
        <Link
          href="/connect"
          className="flex h-7 w-fit items-center gap-2 rounded-full border border-hairline px-3 text-[13px] text-muted hover:border-ink hover:text-ink"
        >
          <span className={`inline-block size-2 rounded-full ${agent.dot}`} aria-hidden />
          {agent.label}
        </Link>
        <UserButton
          showName
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger: "w-full justify-start px-2 py-1.5",
              userButtonBox: "gap-2",
              userButtonOuterIdentifier: "text-sm font-normal text-ink",
              userButtonAvatarBox: "size-6",
            },
          }}
        >
          {admin && (
            <UserButton.MenuItems>
              <UserButton.Link
                label="Admin"
                href="/admin"
                labelIcon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
                    <path d="M8 1.5 2.5 3.75v3.5c0 3.2 2.3 5.9 5.5 7.25 3.2-1.35 5.5-4.05 5.5-7.25v-3.5L8 1.5Z" strokeLinejoin="round" />
                  </svg>
                }
              />
            </UserButton.MenuItems>
          )}
        </UserButton>
      </div>
    </aside>
  );
}
