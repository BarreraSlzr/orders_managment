/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and returns 200.
 * Also supports GET for convenience (e.g. simple anchor link logout).
 */
import { clearSessionCookie } from "@/lib/auth/cookies";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // needs cookie handling — not Edge
export const dynamic = "force-dynamic";

function logout() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function POST() {
  return logout();
}

export async function GET() {
  return logout();
}
