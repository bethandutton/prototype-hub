import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { driveConnections } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/google-drive";
import { readState, redirectUri } from "@/lib/google-oauth";
import { currentOrg } from "@/lib/projects";

// Google sends the person back here after they've allowed Drive access.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = readState(url.searchParams.get("state") ?? "");
  const org = await currentOrg();
  const back = new URL("/projects/new?storage=google-drive", req.url);

  if (!code || !state || !org || state.orgId !== org.orgId || state.userId !== org.userId) {
    back.searchParams.set("error", "Google sign-in didn't complete. Try again.");
    return NextResponse.redirect(back);
  }

  try {
    const { refreshToken, email } = await exchangeCode(code, redirectUri(req));
    await getDb()
      .insert(driveConnections)
      .values({ orgId: org.orgId, connectedBy: org.userId, email, refreshTokenCiphertext: encrypt(refreshToken) })
      .onConflictDoUpdate({
        target: driveConnections.orgId,
        set: { connectedBy: org.userId, email, refreshTokenCiphertext: encrypt(refreshToken) },
      });
  } catch {
    back.searchParams.set("error", "Google didn't let Rehearsal in. Try again.");
  }
  return NextResponse.redirect(back);
}
