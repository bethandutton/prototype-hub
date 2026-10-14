"use client";

import { useTransition } from "react";
import { plans, type Plan } from "@/db/schema";
import { setPersonBanned, setPlan, setTeamSuspended } from "@/lib/admin-actions";

export function PlanSelect({ orgId, plan }: { orgId: string; plan: Plan }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={plan}
      disabled={pending}
      onChange={(e) => start(() => setPlan(orgId, e.target.value as Plan))}
      className="rounded-md border border-hairline bg-paper px-2 py-1 text-sm capitalize disabled:opacity-40"
    >
      {plans.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

export function ToggleButton({
  kind,
  id,
  active,
  on,
  off,
}: {
  kind: "team" | "person";
  id: string;
  active: boolean;
  on: string;
  off: string;
}) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(() => (kind === "team" ? setTeamSuspended(id, !active) : setPersonBanned(id, !active)));
  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
    >
      {active ? on : off}
    </button>
  );
}
