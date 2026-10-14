import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { listComments } from "@/lib/comments";
import { createGrant } from "@/lib/grant";
import { colourFor } from "@/lib/people";
import { currentOrg, getProject, locationOf } from "@/lib/projects";
import { storeFor } from "@/lib/storage";
import { Workspace } from "@/components/workspace";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> };

export default async function ProjectPage({ params, searchParams }: Props) {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const { id } = await params;
  const { v } = await searchParams;
  const project = await getProject(org.orgId, id);
  if (!project) notFound();

  const [store, user, comments] = await Promise.all([storeFor(project), currentUser(), listComments(project.id)]);
  const versions = await store.listVersions();
  const latest = versions[0]?.id ?? null;
  const current = v ?? latest;
  const files = current ? await store.listFiles(current) : [];
  const hasEntry = files.some((f) => f.path === project.entryFile);
  const src = hasEntry && current ? `/view/${createGrant(project.id, org.orgId)}/${current}/${project.entryFile}` : null;

  const me = {
    id: org.userId,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "You",
    colour: colourFor(org.userId),
  };

  return (
    <Workspace
      project={{ id: project.id, name: project.name, location: locationOf(project) }}
      src={src}
      versions={versions}
      currentVersion={current}
      comments={comments}
      me={me}
      realtime={{
        url: process.env.SUPA_SUPABASE_URL ?? null,
        key: process.env.SUPA_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPA_SUPABASE_ANON_KEY ?? null,
      }}
    />
  );
}
