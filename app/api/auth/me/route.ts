/**
 * GET /api/auth/me
 *
 * Returns the current session payload if the user has a valid session,
 * otherwise 401.  Useful for SPAs that need to know who is logged in.
 */
import { verifySessionToken } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ session });
}
