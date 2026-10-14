import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createGrant } from "@/lib/grant";
import { currentOrg, getProject, locationOf } from "@/lib/projects";
import { storeFor } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { PrototypeFrame } from "@/components/prototype-frame";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> };

export default async function ProjectPage({ params, searchParams }: Props) {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const { id } = await params;
  const { v } = await searchParams;
  const project = await getProject(org.orgId, id);
  if (!project) notFound();

  const store = await storeFor(project);
  const versions = await store.listVersions();
  const latest = versions[0]?.id;
  const current = v ?? latest;
  const files = current ? await store.listFiles(current) : [];
  const hasEntry = files.some((f) => f.path === project.entryFile);
  const src = hasEntry && current ? `/view/${createGrant(project.id, org.orgId)}/${current}/${project.entryFile}` : null;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-stage">
        {src ? (
          <PrototypeFrame src={src} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="max-w-[44ch]">
              <h2 className="text-3xl">Nothing on stage yet.</h2>
              <p className="mt-3 text-muted">
                Drop an HTML file or a whole folder here, or ask your agent to publish one to{" "}
                <span className="font-mono text-sm">{locationOf(project)}</span>
                .
              </p>
              <div className="mt-8">
                <UploadDropzone projectId={project.id} large />
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="flex w-[300px] shrink-0 flex-col border-l border-hairline">
        <div className="border-b border-hairline px-5 py-5">
          <Link href="/projects" className="text-xs text-muted underline-offset-4 hover:underline">
            All projects
          </Link>
          <h1 className="mt-2 text-2xl leading-tight">{project.name}</h1>
          <p className="mt-1 truncate font-mono text-xs text-muted">{locationOf(project)}</p>
        </div>

        {src && (
          <div className="border-b border-hairline px-5 py-4">
            <UploadDropzone projectId={project.id} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h2 className="font-sans text-sm text-muted">Versions</h2>
          {versions.length === 0 ? (
            <p className="mt-2 text-sm text-faint">None yet.</p>
          ) : (
            <ol className="mt-2">
              {versions.map((ver, i) => {
                const active = ver.id === current;
                return (
                  <li key={ver.id}>
                    <Link
                      href={i === 0 ? `/projects/${project.id}` : `/projects/${project.id}?v=${ver.id}`}
                      className={`-mx-2 block rounded px-2 py-2 transition-colors hover:bg-stage ${active ? "bg-stage" : ""}`}
                    >
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{ver.message}</span>
                        {i === 0 && <span className="shrink-0 text-xs text-muted">Latest</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {ver.author}, {timeAgo(ver.date)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
