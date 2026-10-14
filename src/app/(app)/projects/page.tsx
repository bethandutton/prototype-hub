import Link from "next/link";
import { OrganizationList } from "@clerk/nextjs";
import { currentOrg, listProjects } from "@/lib/projects";
import { timeAgo } from "@/lib/time";

export default async function ProjectsPage() {
  const org = await currentOrg();

  if (!org) {
    return (
      <main className="mx-auto w-full max-w-[1040px] px-8 pt-24">
        <h1 className="text-4xl">Which team are you working with?</h1>
        <p className="mt-3 max-w-[48ch] text-muted">
          Projects belong to a team. Pick one you&rsquo;re already in, or create a new one.
        </p>
        <div className="mt-10">
          <OrganizationList hidePersonal afterCreateOrganizationUrl="/projects" afterSelectOrganizationUrl="/projects" />
        </div>
      </main>
    );
  }

  const projects = await listProjects(org.orgId);

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <div className="flex items-end justify-between">
        <h1 className="text-4xl">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-80"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-16 max-w-[48ch]">
          <p className="text-lg">Nothing here yet.</p>
          <p className="mt-2 text-muted">
            A project is one prototype and everything said about it. Create one, then drop in an HTML file or ask
            your agent to publish one.
          </p>
        </div>
      ) : (
        <ul className="mt-12 border-t border-hairline">
          {projects.map((p) => (
            <li key={p.id} className="border-b border-hairline">
              <Link
                href={`/projects/${p.id}`}
                className="flex items-baseline justify-between py-5 transition-colors hover:text-muted"
              >
                <span className="serif text-2xl">{p.name}</span>
                <span className="text-sm text-muted">
                  {p.repoOwner}/{p.repoName}
                  {p.path ? `/${p.path}` : ""}
                  <span className="ml-6 text-faint">{timeAgo(p.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
