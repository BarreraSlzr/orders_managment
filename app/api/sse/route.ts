/**
 * SSE endpoint for real-time cache invalidation.
 *
 * Architecture:
 *   DB mutation → domain_events row inserted (status: processed)
 *   → SSE endpoint polls domain_events for new events
 *   → RBAC: only authenticated sessions receive the stream
 *   → Client receives lightweight ping → invalidates tRPC queries
 *
 * Vercel Postgres does not support LISTEN/NOTIFY (no persistent connections).
 * This endpoint polls the domain_events table as a fallback. The pg_notify
 * triggers are installed for future use with a dedicated Postgres provider.
 */
import { verifySessionToken } from "@/lib/auth/session";
import { db } from "@/lib/sql/database";
import {
    NOTIFY_TABLES,
    SSE_CONFIG,
    type NotifyTable,
    type SSEEvent,
} from "@/lib/sse/types";

export const runtime = "nodejs"; // needs DB access — not Edge
export const dynamic = "force-dynamic";

/**
 * Map domain_event.event_type → affected table(s) for SSE routing.
 */
const EVENT_TYPE_TO_TABLES: Record<string, NotifyTable[]> = {
  // ── Orders ────────────────────────────────────────────────────────────────
  "order.created": ["orders"],
  "order.item.updated": ["orders", "order_items"],
  "order.split": ["orders", "order_items"],
  "order.combined": ["orders", "order_items"],
  "order.closed": ["orders"],
  "order.opened": ["orders"],
  "order.payment.toggled": ["orders", "order_items"],
  "order.payment.set": ["orders", "order_items"],
  "order.takeaway.toggled": ["orders", "order_items"],
  "order.products.removed": ["orders", "order_items"],
  "order.batch.closed": ["orders", "order_items"],

  // ── Products ──────────────────────────────────────────────────────────────
  "product.upserted": ["products"],
  "product.consumption.added": ["product_consumptions"],
  "product.consumption.removed": ["product_consumptions"],

  // ── Extras ────────────────────────────────────────────────────────────────
  "extra.upserted": ["extras"],
  "extra.deleted": ["extras"],
  "order.item.extra.toggled": ["order_item_extras"],

  // ── Inventory ─────────────────────────────────────────────────────────────
  "inventory.item.added": ["inventory_items"],
  "inventory.item.toggled": ["inventory_items"],
  "inventory.item.deleted": ["inventory_items"],
  "inventory.transaction.upserted": ["transactions"],
  "inventory.transaction.deleted": ["transactions"],
  "inventory.eod.reconciled": ["inventory_items", "transactions"],
  "inventory.category.upserted": ["categories"],
  "inventory.category.deleted": ["categories"],
  "inventory.category.item.toggled": ["categories", "inventory_items"],

  // ── Platform ──────────────────────────────────────────────────────────────
  "platform_alert.created": ["platform_alerts"],
};

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((c) => {
        const [key, ...rest] = c.trim().split("=");
        return [key, rest.join("=")];
      })
  );
}

export async function GET(request: Request) {
  // ── RBAC: validate session ────────────────────────────────────────
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    const cookies = parseCookies(request.headers.get("cookie"));
    const cookieName = process.env.AUTH_COOKIE_NAME || "__session";
    const token = cookies[cookieName];

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── Parse Last-Event-ID for resumption ────────────────────────────
  const lastEventIdHeader = request.headers.get("Last-Event-ID");
  let cursor = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : 0;
  if (isNaN(cursor)) cursor = 0;

  // If no cursor, start from the latest event
  if (cursor === 0) {
    const latest = await db
      .selectFrom("domain_events")
      .select("id")
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirst();
    cursor = latest?.id ?? 0;
  }

  // ── SSE stream ────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  let alive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (params: {
        event?: string;
        data: string;
        id?: string;
      }) => {
        if (!alive) return;
        let message = "";
        if (params.event) message += `event: ${params.event}\n`;
        if (params.id) message += `id: ${params.id}\n`;
        message += `data: ${params.data}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          alive = false;
        }
      };

      // Heartbeat interval
      const heartbeatTimer = setInterval(() => {
        sendEvent({
          event: "heartbeat",
          data: JSON.stringify({ type: "heartbeat", timestamp: Date.now() }),
        });
      }, SSE_CONFIG.heartbeatIntervalMs);

      // Max connection lifetime
      const maxLifetimeTimer = setTimeout(() => {
        alive = false;
        clearInterval(heartbeatTimer);
        clearInterval(pollTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, SSE_CONFIG.maxConnectionMs);

      // Poll domain_events for new processed events
      const pollTimer = setInterval(async () => {
        if (!alive) {
          clearInterval(pollTimer);
          return;
        }

        try {
          const newEvents = await db
            .selectFrom("domain_events")
            .select(["id", "event_type", "payload", "status"])
            .where("id", ">", cursor)
            .where("status", "=", "processed")
            .orderBy("id", "asc")
            .limit(50)
            .execute();

          for (const row of newEvents) {
            const tables = EVENT_TYPE_TO_TABLES[row.event_type];
            if (!tables) continue;

            // Parse payload to extract affected ID
            let payloadId = "";
            try {
              const parsed =
                typeof row.payload === "string"
                  ? JSON.parse(row.payload)
                  : row.payload;
              payloadId = String(
                parsed.orderId || parsed.id || parsed.itemId || ""
              );
            } catch {
              // malformed payload — skip ID
            }

            for (const table of tables) {
              if (!NOTIFY_TABLES.includes(table)) continue;

              const sseEvent: SSEEvent = {
                table,
                operation: domainEventToOperation(row.event_type),
                id: payloadId,
                cursor: row.id,
              };

              sendEvent({
                event: "invalidate",
                data: JSON.stringify(sseEvent),
                id: String(row.id),
              });
            }

            cursor = row.id;
          }
        } catch (err) {
          // DB error — log but keep the stream alive
          console.error("[SSE] Poll error:", err);
        }
      }, SSE_CONFIG.pollIntervalMs);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        alive = false;
        clearInterval(heartbeatTimer);
        clearInterval(pollTimer);
        clearTimeout(maxLifetimeTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Send initial connected event
      sendEvent({
        event: "connected",
        data: JSON.stringify({ cursor }),
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Map domain event type to DML operation for SSE */
function domainEventToOperation(
  eventType: string
): "INSERT" | "UPDATE" | "DELETE" {
  if (eventType.includes("created") || eventType.includes("added")) {
    return "INSERT";
  }
  if (eventType.includes("deleted") || eventType.includes("removed")) {
    return "DELETE";
  }
  return "UPDATE";
}
