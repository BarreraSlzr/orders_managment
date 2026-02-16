/**
 * SSE (Server-Sent Events) types for real-time cache invalidation.
 *
 * Flow: DB change → pg_notify / domain_events → SSE endpoint (RBAC filter)
 *       → client EventSource → tRPC query invalidation
 */

/** Tables that emit change notifications */
export const NOTIFY_TABLES = [
  "orders",
  "order_items",
  "products",
  "inventory_items",
  "categories",
  "transactions",
] as const;

export type NotifyTable = (typeof NOTIFY_TABLES)[number];

/** Lightweight SSE invalidation event — no heavy payloads */
export interface SSEEvent {
  /** Which table changed */
  table: NotifyTable;
  /** DML operation */
  operation: "INSERT" | "UPDATE" | "DELETE";
  /** Affected row ID (uuid or serial) */
  id: string;
  /** Monotonic cursor from domain_events.id (used for resuming) */
  cursor: number;
}

/** Heartbeat sent to keep the connection alive */
export interface SSEHeartbeat {
  type: "heartbeat";
  timestamp: number;
}

export type SSEMessage =
  | { type: "invalidate"; data: SSEEvent }
  | { type: "heartbeat"; data: SSEHeartbeat };

/**
 * Maps a table name to the tRPC query keys that should be invalidated
 * when that table changes.  Each key is an array passed to
 * `queryClient.invalidateQueries({ queryKey })`.
 *
 * The first element matches the tRPC router path structure that
 * TanStack Query uses internally (e.g. `["orders", "list"]`).
 */
export const TABLE_INVALIDATION_MAP: Record<NotifyTable, string[][]> = {
  orders: [["orders", "list"], ["orders", "getDetails"]],
  order_items: [["orders", "list"], ["orders", "getDetails"]],
  products: [["products", "list"], ["products", "export"]],
  inventory_items: [["inventory", "items", "list"]],
  categories: [["inventory", "categories", "list"]],
  transactions: [["inventory", "transactions", "list"]],
};

/** SSE endpoint configuration */
export const SSE_CONFIG = {
  /** Polling interval when pg LISTEN is unavailable (ms) */
  pollIntervalMs: 3_000,
  /** Heartbeat interval (ms) */
  heartbeatIntervalMs: 30_000,
  /** Maximum connection lifetime (ms) — prevents zombie connections */
  maxConnectionMs: 5 * 60 * 1_000,
  /** Channel name used by pg_notify */
  pgChannel: "table_changes",
} as const;
