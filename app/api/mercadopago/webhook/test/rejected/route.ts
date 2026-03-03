import { verifySessionToken } from "@/lib/auth/session";
import { createPlatformAlert } from "@/lib/services/alerts/alertsService";
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
      orderId?: unknown;
      paymentId?: unknown;
      notificationId?: unknown;
      tenantId?: unknown;
    };

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const sessionToken = request.cookies.get(cookieName)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    const tenantIdFromBody =
      typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const tenantId = tenantIdFromBody || session?.tenant_id || "";
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required when no authenticated session is present" },
        { status: 400 },
      );
    }

    let attempt = await getDb()
      .selectFrom("payment_sync_attempts")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("order_id", "=", orderId)
      .where("status", "not in", ["approved", "rejected", "canceled", "error"])
      .orderBy("created", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!attempt) {
      attempt = await getDb()
        .insertInto("payment_sync_attempts")
        .values({
          tenant_id: tenantId,
          order_id: orderId,
          amount_cents: 100,
          status: "pending",
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    const paymentId =
      typeof body.paymentId === "string" && body.paymentId.trim()
        ? body.paymentId.trim()
        : `test-rejected-${attempt.id}`;

    const notificationId =
      typeof body.notificationId === "string" && body.notificationId.trim()
        ? body.notificationId.trim()
        : `notif-rejected-${attempt.id}`;

    await getDb()
      .updateTable("payment_sync_attempts")
      .set({
        status: "rejected",
        mp_transaction_id: paymentId,
        response_data: {
          id: paymentId,
          status: "rejected",
          external_reference: orderId,
          source: "e2e_webhook_test",
        },
        last_mp_notification_id: notificationId,
      })
      .where("id", "=", attempt.id)
      .execute();

    await createPlatformAlert({
      tenantId,
      scope: "tenant",
      type: "payment",
      severity: "warning",
      title: `Pago rechazado — orden ${orderId.slice(0, 8)}`,
      body: "Mercado Pago rechazó el cobro. Puedes reintentar desde la orden.",
      sourceType: "mp_payment",
      sourceId: paymentId,
      metadata: {
        order_id: orderId,
        payment_id: paymentId,
        mp_status: "rejected",
        notification_id: notificationId,
      },
    });

    const activeAttempt = await getDb()
      .selectFrom("payment_sync_attempts")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("order_id", "=", orderId)
      .where("status", "not in", ["approved", "rejected", "canceled", "error"])
      .executeTakeFirst();

    return NextResponse.json(
      {
        received: true,
        simulated: true,
        orderId,
        tenantId,
        attemptId: attempt.id,
        status: "rejected",
        retryReady: !activeAttempt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[mp/webhook/test/rejected]", error);
    const message =
      error instanceof Error ? error.message : "Failed to simulate rejected payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
