import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens } from "@/db/schema";
import { currentOrg } from "@/lib/projects";
import { timeAgo } from "@/lib/time";
import { AgentTokenForm, RevokeButton } from "@/components/agent-token-form";

export default async function ConnectPage() {
  const org = await currentOrg();
  if (!org) redirect("/projects");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const mcpUrl = `${protocol}://${host}/api/mcp`;

  const tokens = await getDb()
    .select()
    .from(agentTokens)
    .where(and(eq(agentTokens.orgId, org.orgId), eq(agentTokens.userId, org.userId)))
    .orderBy(desc(agentTokens.createdAt));

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <h1 className="text-4xl">Connect your agent</h1>
      <p className="mt-3 max-w-[52ch] text-muted">
        Your agent runs on your machine, on your own plan. Give it a token and it can read this team&rsquo;s
        prototypes and publish new versions as you. Anything it publishes is credited to you.
      </p>

      <div className="mt-14 grid gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AgentTokenForm mcpUrl={mcpUrl} />

        <section>
          <h2 className="font-sans text-lg">Your tokens</h2>
          {tokens.length === 0 ? (
            <p className="mt-4 text-sm text-muted">None yet. Create one on the left.</p>
          ) : (
            <ul className="mt-4 border-t border-hairline">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between border-b border-hairline py-4">
                  <span>
                    <span className="block">{t.name}</span>
                    <span className="block text-xs text-muted">
                      Created {timeAgo(t.createdAt)}
                      {t.lastUsedAt ? `, last used ${timeAgo(t.lastUsedAt)}` : ", not used yet"}
                    </span>
                  </span>
                  <RevokeButton id={t.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
