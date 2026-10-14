import { redirect } from "next/navigation";
import { currentOrg, getGithubConnection } from "@/lib/projects";
import { NewProjectForm } from "@/components/new-project-form";

export default async function NewProjectPage() {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const connection = await getGithubConnection(org.orgId);

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <h1 className="text-4xl">New project</h1>
      <p className="mt-3 max-w-[48ch] text-muted">
        Your prototype files stay in a place your team already controls. Rehearsal reads from it and publishes to it;
        it never keeps a copy.
      </p>
      <NewProjectForm githubLogin={connection?.login ?? null} />
    </main>
  );
}
