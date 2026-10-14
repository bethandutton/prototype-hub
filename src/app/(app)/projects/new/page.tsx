import { redirect } from "next/navigation";
import { driveConfigured } from "@/lib/google-drive";
import { currentOrg, getDriveConnection, getGithubConnection } from "@/lib/projects";
import { NewProjectForm } from "@/components/new-project-form";

type Props = { searchParams: Promise<{ storage?: string; error?: string }> };

export default async function NewProjectPage({ searchParams }: Props) {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const [{ storage, error }, github, drive] = await Promise.all([
    searchParams,
    getGithubConnection(org.orgId),
    getDriveConnection(org.orgId),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <h1 className="text-4xl">New project</h1>
      <p className="mt-3 max-w-[48ch] text-muted">
        Your prototype files stay in a place your team already controls. Rehearsal reads from it and publishes to it;
        it never keeps a copy.
      </p>
      <NewProjectForm
        githubLogin={github?.login ?? null}
        driveEmail={drive?.email ?? null}
        driveAvailable={driveConfigured()}
        initialStorage={storage === "google-drive" ? "google-drive" : "github"}
        error={error ?? null}
      />
    </main>
  );
}
