/**
 * Schema migration runner — applies versioned, idempotent migrations.
 *
 * Each migration has a numeric version, a description, and an `up` function
 * that runs the required SQL.  The runner records applied versions in a
 * `schema_migrations` table so migrations are never re-applied.
 *
 * All migrations MUST be idempotent (use IF NOT EXISTS, CREATE OR REPLACE, etc.)
 * because the seed() function also uses ifNotExists for table creation.
 */

import { db, sql } from "./database";

// ── Migration type ───────────────────────────────────────────────────────────

export interface Migration {
  /** Monotonic version number (1, 2, 3, …) */
  version: number;
  /** Human-readable description shown in logs */
  description: string;
  /** Idempotent migration function */
  up: () => Promise<void>;
}

// ── schema_migrations bootstrap ──────────────────────────────────────────────

async function ensureMigrationsTable(): Promise<void> {
  await db.schema
    .createTable("schema_migrations")
    .ifNotExists()
    .addColumn("version", "integer", (col) => col.primaryKey())
    .addColumn("description", "varchar", (col) => col.notNull())
    .addColumn("applied_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

async function getAppliedVersions(): Promise<Set<number>> {
  const rows = (await db
    .selectFrom("schema_migrations" as never)
    .select("version" as never)
    .execute()) as unknown as { version: number }[];
  return new Set(rows.map((r) => r.version));
}

async function recordMigration(params: {
  version: number;
  description: string;
}): Promise<void> {
  await db
    .insertInto("schema_migrations" as never)
    .values({
      version: params.version,
      description: params.description,
    } as never)
    .execute();
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pending migrations in order.
 * Returns the list of newly-applied version numbers.
 */
export async function runMigrations(params: {
  migrations: Migration[];
}): Promise<number[]> {
  await ensureMigrationsTable();
  const applied = await getAppliedVersions();

  const pending = params.migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    console.info("[migrate] No pending migrations.");
    return [];
  }

  const appliedVersions: number[] = [];

  for (const migration of pending) {
    console.info(
      `[migrate] Applying v${migration.version}: ${migration.description}…`
    );
    try {
      await migration.up();
      await recordMigration({
        version: migration.version,
        description: migration.description,
      });
      appliedVersions.push(migration.version);
      console.info(`[migrate] ✓ v${migration.version} applied.`);
    } catch (error) {
      console.error(
        `[migrate] ✗ v${migration.version} FAILED:`,
        error
      );
      throw error; // Stop on first failure
    }
  }

  console.info(
    `[migrate] Done — ${appliedVersions.length} migration(s) applied.`
  );
  return appliedVersions;
}

/**
 * Get current migration status.
 */
export async function getMigrationStatus(params: {
  migrations: Migration[];
}): Promise<{
  applied: number[];
  pending: number[];
  current: number | null;
}> {
  await ensureMigrationsTable();
  const appliedSet = await getAppliedVersions();
  const applied = Array.from(appliedSet).sort((a, b) => a - b);
  const pending = params.migrations
    .filter((m) => !appliedSet.has(m.version))
    .map((m) => m.version)
    .sort((a, b) => a - b);
  const current = applied.length > 0 ? applied[applied.length - 1] : null;

  return { applied, pending, current };
}
