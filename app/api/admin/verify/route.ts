import {
    getAdminConfig,
    isValidIdentity,
} from "@/lib/auth/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const config = getAdminConfig();

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const admin = body?.admin;

  if (!password || password !== config.password) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidIdentity({ candidate: admin })) {
    return NextResponse.json(
      { error: "Invalid admin payload" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(config.cookieName, config.apiKey, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });

  return response;
}
