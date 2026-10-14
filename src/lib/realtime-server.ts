// Tells everyone looking at a project that something changed, so their view
// refreshes. Uses Supabase Realtime's broadcast endpoint; the browser side
// listens in src/lib/realtime.ts.

export type ProjectEvent = "comments" | "versions";

export async function notifyProject(projectId: string, event: ProjectEvent) {
  const url = process.env.SUPA_SUPABASE_URL;
  const key = process.env.SUPA_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPA_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `project:${projectId}`, event, payload: {} }] }),
    });
  } catch {
    // A missed refresh is not worth failing the action for.
  }
}
