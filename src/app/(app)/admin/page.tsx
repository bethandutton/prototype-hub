import { notFound } from "next/navigation";
import { adminOverview, isAdmin } from "@/lib/admin";
import { timeAgo } from "@/lib/time";
import { PlanSelect, ToggleButton } from "@/components/admin-controls";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const { teams, people } = await adminOverview();

  return (
    <main className="mx-auto w-full max-w-[1040px] px-8 pt-24 pb-32">
      <h1 className="text-4xl">Admin</h1>
      <p className="mt-3 text-muted">
        {teams.length} team{teams.length === 1 ? "" : "s"}, {people.length} {people.length === 1 ? "person" : "people"}.
        Plans are recorded but don&rsquo;t limit anything yet.
      </p>

      <section className="mt-16">
        <h2 className="font-sans text-lg">Teams</h2>
        <table className="mt-4 w-full border-t border-hairline text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 font-normal">Team</th>
              <th className="py-3 font-normal">Members</th>
              <th className="py-3 font-normal">Created</th>
              <th className="py-3 font-normal">Plan</th>
              <th className="py-3 text-right font-normal">Access</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className={`border-t border-hairline ${t.suspendedAt ? "text-faint" : ""}`}>
                <td className="py-3">{t.name}</td>
                <td className="py-3">{t.members}</td>
                <td className="py-3">{timeAgo(t.createdAt)}</td>
                <td className="py-3">
                  <PlanSelect orgId={t.id} plan={t.plan} />
                </td>
                <td className="py-3 text-right">
                  <ToggleButton kind="team" id={t.id} active={Boolean(t.suspendedAt)} on="Restore" off="Revoke" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-16">
        <h2 className="font-sans text-lg">People</h2>
        <table className="mt-4 w-full border-t border-hairline text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 font-normal">Name</th>
              <th className="py-3 font-normal">Email</th>
              <th className="py-3 font-normal">Teams</th>
              <th className="py-3 font-normal">Last active</th>
              <th className="py-3 text-right font-normal">Access</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className={`border-t border-hairline ${p.banned ? "text-faint" : ""}`}>
                <td className="py-3">{p.name}</td>
                <td className="py-3">{p.email}</td>
                <td className="py-3">{p.teams.join(", ") || "—"}</td>
                <td className="py-3">{p.lastActiveAt ? timeAgo(p.lastActiveAt) : "Never"}</td>
                <td className="py-3 text-right">
                  <ToggleButton kind="person" id={p.id} active={p.banned} on="Restore" off="Revoke" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
