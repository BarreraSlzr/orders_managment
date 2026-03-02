/**
 * /api/billing/subscribe
 *
 * Creates a MercadoPago preapproval (subscription) for the authenticated tenant.
 * Returns the init_point URL so the client can redirect to MP checkout.
 */
import { verifySessionToken } from "@/lib/auth/session";
import { createSubscription } from "@/lib/services/billing/subscriptionService";
import { getMpPlatformConfig } from "@/lib/services/mercadopago/platformConfig";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // ── Authenticate ─────────────────────────────────────────────────────────
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifySessionToken(sessionToken);
    if (!session?.tenant_id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── Parse + validate body ─────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const payerEmail =
      body && typeof body === "object" && "payerEmail" in body
        ? String((body as Record<string, unknown>).payerEmail ?? "").trim()
        : "";

    if (!payerEmail) {
      return NextResponse.json({ error: "payerEmail is required" }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(payerEmail)) {
      return NextResponse.json({ error: "payerEmail is invalid" }, { status: 400 });
    }

    // ── Billing config ────────────────────────────────────────────────────────
    const { billingAccessToken } = await getMpPlatformConfig();
    if (!billingAccessToken) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 503 },
      );
    }

    const preapprovalPlanId = process.env.MP_BILLING_PLAN_ID?.trim();
    if (!preapprovalPlanId) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 503 },
      );
    }

    // ── Create subscription ───────────────────────────────────────────────────
    const origin = new URL(request.url).origin;
    const result = await createSubscription({
      accessToken: billingAccessToken,
      preapprovalPlanId,
      payerEmail,
      externalReference: session.tenant_id,
      backUrl: `${origin}/onboardings/billing/callback`,
      reason: "Orders Management — Plan Mensual",
    });

    return NextResponse.json(
      { id: result.id, init_point: result.init_point },
      { status: 200 },
    );
  } catch (error) {
    console.error("[billing/subscribe] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
