import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTokens } from "@/db/schema";
import { usedRecently } from "@/lib/agent-status";
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
      <div className="grid gap-16 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <section>
          <h1 className="text-5xl leading-[1.05]">
            Your agent.
            <br />
            Your plan.
            <br />
            Our stage.
          </h1>
          <p className="mt-6 max-w-[44ch] text-lg text-muted">
            Claude Code, Cursor, Codex or anything else that speaks MCP. It runs on your machine and your own
            subscription. Rehearsal just gives it a way in: it reads this team&rsquo;s prototypes and publishes
            new versions, and everything it does is credited to you.
          </p>
          <div className="mt-12">
            <AgentTokenForm mcpUrl={mcpUrl} />
          </div>
        </section>

        <section className="md:pt-3">
          <h2 className="font-sans text-sm text-muted">Agents you&rsquo;ve connected</h2>
          {tokens.length === 0 ? (
            <p className="mt-5 text-sm text-faint">None yet.</p>
          ) : (
            <ul className="mt-4 border-t border-hairline">
              {tokens.map((t) => {
                const active = usedRecently(t.lastUsedAt);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-6 border-b border-hairline py-4">
                    <span className="flex items-start gap-3">
                      <span
                        className={`mt-2 inline-block size-2 shrink-0 rounded-full ${active ? "bg-[#12A594]" : "bg-faint"}`}
                        aria-hidden
                      />
                      <span>
                        <span className="block">{t.name}</span>
                        <span className="block text-xs text-muted">
                          {t.lastUsedAt
                            ? `${active ? "Connected, " : ""}last used ${timeAgo(t.lastUsedAt)}`
                            : `Awaiting first connection, created ${timeAgo(t.createdAt)}`}
                        </span>
                      </span>
                    </span>
                    <RevokeButton id={t.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
