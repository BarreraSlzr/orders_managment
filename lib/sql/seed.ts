/**
 * Database schema bootstrap — delegates to the versioned migration runner.
 *
 * Called from instrumentation.ts on every server start. The migration runner
 * is idempotent: it only applies migrations that haven't been recorded yet
 * in the `schema_migrations` table.
 *
 * For existing databases that were created before the migration system,
 * migration v1 (baseline) uses IF NOT EXISTS for all tables, so it is
 * safe to run against a populated database — no data is lost.
 */

import { runMigrations } from "./migrate";
import { allMigrations } from "./migrations";

export async function seed() {
  console.info("Start schema creation (migration runner)");
  const applied = await runMigrations({ migrations: allMigrations });
  if (applied.length > 0) {
    console.info(`DB schema finished — applied migrations: ${applied.join(", ")}`);
  } else {
    console.info("DB schema up to date — no new migrations.");
  }
}  