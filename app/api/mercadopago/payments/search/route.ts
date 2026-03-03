import { verifySessionToken } from "@/lib/auth/session";
import { getCredentials } from "@/lib/services/mercadopago/credentialsService";
import { searchPaymentsByExternalReference } from "@/lib/services/mercadopago/paymentService";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySessionToken(sessionToken);
    if (!session?.tenant_id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const externalReference =
      request.nextUrl.searchParams.get("external_reference")?.trim() ?? "";
    if (!externalReference) {
      return NextResponse.json(
        { error: "external_reference is required" },
        { status: 400 },
      );
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");

    const creds = await getCredentials({ tenantId: session.tenant_id });
    if (!creds?.access_token) {
      return NextResponse.json(
        { error: "Mercado Pago not configured" },
        { status: 412 },
      );
    }

    const result = await searchPaymentsByExternalReference({
      accessToken: creds.access_token,
      externalReference,
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10,
      offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[mp/payments/search]", error);
    const message =
      error instanceof Error ? error.message : "Failed to search payments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
