import { processBillingEvent } from "@/lib/services/entitlements/billingWebhookService";
import { getDb } from "@/lib/sql/database";
import { NextRequest, NextResponse } from "next/server";

function getAdminKeyFromHeaders(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export async function POST(request: NextRequest) {
  try {
    const expectedAdminKey =
      process.env.ADMIN_SHARED_API_KEY ?? process.env.ADMIN_SECRET ?? "";
    const providedAdminKey = getAdminKeyFromHeaders(request);

    if (!expectedAdminKey || providedAdminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      tenantId?: unknown;
      tenantName?: unknown;
      eventType?: unknown;
      status?: unknown;
      externalSubscriptionId?: unknown;
      externalEventId?: unknown;
      metadata?: unknown;
    };

    const providedTenantId =
      typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const tenantName =
      typeof body.tenantName === "string" ? body.tenantName.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    let tenantId = providedTenantId;
    if (!tenantId && tenantName) {
      const tenant = await getDb()
        .selectFrom("tenants")
        .select("id")
        .where("name", "=", tenantName)
        .executeTakeFirst();
      tenantId = tenant?.id ?? "";
    }

    if (!tenantId || !eventType || !status) {
      return NextResponse.json(
        { error: "tenantId (or tenantName), eventType and status are required" },
        { status: 400 },
      );
    }

    await processBillingEvent({
      tenantId,
      provider: "mercadopago",
      eventType,
      status,
      externalSubscriptionId:
        typeof body.externalSubscriptionId === "string"
          ? body.externalSubscriptionId
          : undefined,
      externalEventId:
        typeof body.externalEventId === "string"
          ? body.externalEventId
          : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, unknown>)
          : undefined,
    });

    return NextResponse.json({ received: true, simulated: true }, { status: 200 });
  } catch (error) {
    console.error("[billing/webhook/test]", error);
    const message =
      error instanceof Error ? error.message : "Failed to simulate billing event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
