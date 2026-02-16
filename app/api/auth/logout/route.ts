/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and returns 200.
 * Also supports GET for convenience (e.g. simple anchor link logout).
 */
import { clearSessionCookie } from "@/lib/auth/cookies";
import { NextResponse } from "next/server";

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
