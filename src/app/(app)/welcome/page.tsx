import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { driveConfigured } from "@/lib/google-drive";
import { currentOrg, getDriveConnection, getGithubConnection } from "@/lib/projects";
import { setupProgress } from "@/lib/setup";
import { AgentTokenForm } from "@/components/agent-token-form";
import { ConnectGithub } from "@/components/connect-github";

export default async function WelcomePage() {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const [setup, connection, drive] = await Promise.all([
    setupProgress(org.orgId, org.userId),
    getGithubConnection(org.orgId),
    getDriveConnection(org.orgId),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const mcpUrl = `${protocol}://${host}/api/mcp`;

  const steps = [
    {
      key: "storage",
      done: setup.storage,
      title: "Choose where your files live",
      summary: connection
        ? `GitHub, as ${connection.login}`
        : drive
          ? `Google Drive, as ${drive.email}`
          : driveConfigured()
            ? "GitHub or Google Drive"
            : "GitHub for now; Google Drive is next",
      body: (
        <>
          <p className="max-w-[52ch] text-muted">
            Rehearsal never keeps your prototypes. They live in a GitHub repository your team owns, which also
            means every version is kept for free. Connecting takes about a minute.
          </p>
          <div className="mt-6">
            <ConnectGithub />
          </div>
          {driveConfigured() && (
            <p className="mt-6 text-sm text-muted">
              Prefer Google Drive?{" "}
              <Link href="/projects/new?storage=google-drive" className="underline underline-offset-4">
                Connect it instead
              </Link>
              .
            </p>
          )}
        </>
      ),
    },
    {
      key: "agent",
      done: setup.agent,
      title: "Connect your agent",
      summary: setup.agent ? "Connected" : "Claude Code, Cursor, Codex or any MCP agent",
      body: (
        <>
          <p className="max-w-[52ch] text-muted">
            Your agent runs on your machine and your own plan. Create a token, paste the message into your
            agent, and it connects itself. This step is done once it has said hello.
          </p>
          <div className="mt-6">
            <AgentTokenForm mcpUrl={mcpUrl} />
          </div>
        </>
      ),
    },
    {
      key: "project",
      done: setup.project,
      title: "Put a prototype on stage",
      summary: setup.project ? "Done" : "Drop in an HTML file, or ask your agent",
      body: (
        <>
          <p className="max-w-[52ch] text-muted">
            Create a project, then drag an HTML file or folder onto it. Or tell your agent: &ldquo;Create a
            Rehearsal project called Checkout and publish a first version of the checkout page.&rdquo;
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-80"
          >
            Create a project
          </Link>
        </>
      ),
    },
  ];

  const current = steps.find((s) => !s.done)?.key;

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <h1 className="text-5xl leading-[1.05]">Three things, then you&rsquo;re on.</h1>
      <p className="mt-5 max-w-[52ch] text-lg text-muted">
        {setup.complete
          ? "All set. Your team can review prototypes together, and your agent can make the changes."
          : "Each takes a minute or two. Pick up where you left off any time from the Set up link in the top bar."}
      </p>

      <ol className="mt-16 border-t border-hairline">
        {steps.map((step, i) => {
          const open = step.key === current;
          return (
            <li key={step.key} className="border-b border-hairline py-8">
              <div className="flex items-baseline gap-6">
                <span className={`serif w-6 text-2xl ${step.done ? "text-faint" : ""}`}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-6">
                    <h2 className={`font-sans text-xl ${step.done ? "text-muted line-through decoration-faint" : ""}`}>
                      {step.title}
                    </h2>
                    <span className="text-sm text-muted">{step.done ? "Done" : open ? "Next" : ""}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{step.summary}</p>
                  {open && <div className="mt-6">{step.body}</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {setup.complete && (
        <Link href="/projects" className="mt-10 inline-block text-sm underline underline-offset-4">
          Go to your projects
        </Link>
      )}
    </main>
  );
}
