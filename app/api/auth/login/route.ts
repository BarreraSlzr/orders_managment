/**
 * GET /api/auth/login
 *
 * Stub login endpoint.  In the current MVP this accepts a `sub` query
 * parameter and issues a session cookie.  In a production deployment
 * this would redirect to an external IdP / OAuth flow.
 *
 * Query params:
 *   - sub       (required)  subject / user identifier
 *   - redirect  (optional)  where to send the user after login (default "/")
 */
import { setSessionCookie } from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/passwords";
import { getUserForLogin } from "@/lib/sql/functions/users";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sub = request.nextUrl.searchParams.get("sub");
  const redirect = request.nextUrl.searchParams.get("redirect") || "/";

  if (!sub) {
    return NextResponse.json(
      { error: "Missing required query parameter: sub" },
      { status: 400 }
    );
  }

  const redirectUrl = new URL(redirect, request.url);
  const response = NextResponse.redirect(redirectUrl);

  await setSessionCookie(response, sub);

  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const username =
    typeof record.username === "string" ? record.username.trim() : "";
  const password =
    typeof record.password === "string" ? record.password : "";
  const tenant = typeof record.tenant === "string" ? record.tenant.trim() : "";

  if (!username || !password || !tenant) {
    return NextResponse.json(
      { error: "username, password, and tenant are required" },
      { status: 400 }
    );
  }

  const user = await getUserForLogin({ username, tenantName: tenant });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = verifyPassword({
    password,
    hash: user.password_hash,
    salt: user.password_salt,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    role: user.role,
    tenant: user.tenant_name,
  });

  await setSessionCookie(response, user.id, {
    tenant_id: user.tenant_id,
    role: user.role,
    username: user.username,
    tenant_name: user.tenant_name,
    permissions: user.permissions,
  });

  return response;
}
