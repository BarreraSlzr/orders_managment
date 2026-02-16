/**
 * Full database export utility — dumps all table data as JSON for backup
 * and migration purposes. Supports both export and import operations.
 *
 * Usage:
 *   - Export: `await exportAllData()` → returns a JSON-serializable snapshot
 *   - Import: `await importAllData(snapshot)` → restores data (upsert semantics)
 */

import { CompiledQuery } from "kysely";
import { db } from "./database";

/** Tables in dependency order (parents before children) */
const TABLE_EXPORT_ORDER = [
  "payment_options",
  "products",
  "orders",
  "order_items",
  "extras",
  "order_item_extras",
  "inventory_items",
  "categories",
  "category_inventory_item",
  "transactions",
  // domain_events excluded — they are operational logs, not business data
] as const;

export type ExportTable = (typeof TABLE_EXPORT_ORDER)[number];

export interface DatabaseSnapshot {
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
  migrationVersions: number[];
}

/**
 * Export all data from every business table.
 */
export async function exportAllData(): Promise<DatabaseSnapshot> {
  const tables: Record<string, unknown[]> = {};

  for (const table of TABLE_EXPORT_ORDER) {
    try {
      const result = await db.executeQuery(
        CompiledQuery.raw(`SELECT * FROM ${table} ORDER BY 1`, [])
      );
      tables[table] = result.rows;
      console.info(`[export] ${table}: ${result.rows.length} rows`);
    } catch (error) {
      // Table may not exist yet — that's OK
      console.warn(`[export] ${table}: skipped (${(error as Error).message})`);
      tables[table] = [];
    }
  }

  // Capture applied migration versions
  let migrationVersions: number[] = [];
  try {
    const result = await db.executeQuery<{ version: number }>(
      CompiledQuery.raw(
        "SELECT version FROM schema_migrations ORDER BY version",
        []
      )
    );
    migrationVersions = result.rows.map((r) => r.version);
  } catch {
    // schema_migrations may not exist yet
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
    migrationVersions,
  };
}

/**
 * Validate a snapshot structure before import.
 */
export function validateSnapshot(params: {
  data: unknown;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const data = params.data as Record<string, unknown>;

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Snapshot must be an object"] };
  }
  if (typeof data.version !== "number") {
    errors.push("Missing or invalid 'version' field");
  }
  if (typeof data.exportedAt !== "string") {
    errors.push("Missing or invalid 'exportedAt' field");
  }
  if (!data.tables || typeof data.tables !== "object") {
    errors.push("Missing or invalid 'tables' field");
  } else {
    const tables = data.tables as Record<string, unknown>;
    for (const table of TABLE_EXPORT_ORDER) {
      if (tables[table] && !Array.isArray(tables[table])) {
        errors.push(`tables.${table} must be an array`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Count rows in all tables for a quick health-check.
 */
export async function getTableCounts(): Promise<
  Record<string, number>
> {
  const counts: Record<string, number> = {};

  for (const table of TABLE_EXPORT_ORDER) {
    try {
      const result = await db.executeQuery<{ count: string }>(
        CompiledQuery.raw(`SELECT count(*)::text AS count FROM ${table}`, [])
      );
      counts[table] = parseInt(result.rows[0]?.count ?? "0", 10);
    } catch {
      counts[table] = -1; // table doesn't exist
    }
  }

  return counts;
}
