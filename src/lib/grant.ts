import { createHmac, timingSafeEqual } from "node:crypto";

// A grant is a short-lived, signed permission to view one project's files.
// It travels in the URL path so the sandboxed prototype frame, which has no
// cookies, can still fetch its own stylesheets, scripts and images.

type Grant = { projectId: string; orgId: string; exp: number };

const ttlSeconds = 60 * 60;

function sign(payload: string) {
  return createHmac("sha256", process.env.TOKEN_SECRET!).update(payload).digest("base64url");
}

export function createGrant(projectId: string, orgId: string) {
  const payload = Buffer.from(
    JSON.stringify({ projectId, orgId, exp: Math.floor(Date.now() / 1000) + ttlSeconds } satisfies Grant),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyGrant(token: string): Grant | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }
  const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Grant;
  return grant.exp > Date.now() / 1000 ? grant : null;
}
