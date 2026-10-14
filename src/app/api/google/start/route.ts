import { NextResponse } from "next/server";
import { authUrl, driveConfigured } from "@/lib/google-drive";
import { redirectUri, signState } from "@/lib/google-oauth";
import { currentOrg } from "@/lib/projects";

// Sends the person to Google to let Rehearsal use their Drive for this team.
export async function GET(req: Request) {
  const org = await currentOrg();
  if (!org) return NextResponse.redirect(new URL("/projects", req.url));
  if (!driveConfigured()) return new NextResponse("Google Drive isn't set up yet.", { status: 503 });
  return NextResponse.redirect(authUrl(redirectUri(req), signState(org.orgId, org.userId)));
}
