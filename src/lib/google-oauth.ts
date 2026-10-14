import { createHmac, timingSafeEqual } from "node:crypto";

// Helpers for the Google sign-in round trip in src/app/api/google.

export function redirectUri(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}/api/google/callback`;
}

type State = { orgId: string; userId: string; t: number };

function sign(payload: string) {
  return createHmac("sha256", process.env.TOKEN_SECRET!).update(payload).digest("base64url");
}

export function signState(orgId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ orgId, userId, t: Date.now() } satisfies State)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readState(state: string): State | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as State;
  return Date.now() - data.t < 15 * 60 * 1000 ? data : null;
}
