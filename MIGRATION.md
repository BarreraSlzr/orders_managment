# Database Migration & Data Safety

## Overview

This project uses a **versioned migration system** backed by a `schema_migrations` table.
Every schema change is expressed as an idempotent migration (using `IF NOT EXISTS`, `CREATE OR REPLACE`, etc.) so that the runner is safe to execute repeatedly.

The migration runner replaces the old monolithic `seed()` function. On application startup (`instrumentation.ts → seed()`), all pending migrations are applied automatically.

---

## How It Works

| File | Purpose |
|------|---------|
| `lib/sql/migrate.ts` | Migration runner: bootstraps `schema_migrations`, applies pending migrations |
| `lib/sql/migrations.ts` | All migration definitions (v1 – baseline, v2 – extras, v3 – triggers) |
| `lib/sql/backup.ts` | Export full DB snapshot, validate snapshots, get table counts |
| `lib/sql/seed.ts` | Thin entry point that delegates to `runMigrations()` |

### Migration Lifecycle

```
App start → instrumentation.ts → seed() → runMigrations(allMigrations)
                                              ↓
                              ensureMigrationsTable()
                                              ↓
                              getAppliedVersions() → Set<number>
                                              ↓
                              filter pending → sort by version → run sequentially
                                              ↓
                              record each in schema_migrations
```

---

## Current Migrations

| Version | Description |
|---------|-------------|
| 1 | Baseline schema (products, orders, order_items, payment_options, inventory, categories, transactions, domain_events) |
| 2 | Extras tables (extras, order_item_extras) |
| 3 | All triggers (order total calculation, extras pricing, pg_notify for SSE) |

---

## Adding a New Migration

1. Open `lib/sql/migrations.ts`.
2. Add a new entry to the `allMigrations` array:

```typescript
{
  version: 4,
  description: "Add discount column to orders",
  up: async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0`.execute(db);
  },
},
```

3. Keep migrations **idempotent** — use `IF NOT EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`, etc.
4. Never modify an existing migration that has already been applied to production.
5. Run `npx tsc --noEmit && npx vitest run` to validate.

---

## Admin tRPC Endpoints

All endpoints require `adminProcedure` (admin API key via `x-admin-key` header).

| Procedure | Type | Description |
|-----------|------|-------------|
| `admin.migrationStatus` | query | Returns applied versions, pending versions, current version |
| `admin.tableCounts` | query | Row counts for all business tables |
| `admin.exportData` | query | Full database snapshot as JSON |
| `admin.validateSnapshot` | mutation | Validates a snapshot structure before import |

### Example: Check Migration Status

```typescript
const status = await trpc.admin.migrationStatus.query();
// { applied: [1, 2, 3], pending: [], current: 3 }
```

### Example: Export Full Backup

```typescript
const snapshot = await trpc.admin.exportData.query();
// { version: 1, exportedAt: "...", tables: { products: [...], orders: [...], ... }, migrationVersions: [1, 2, 3] }
```

---

## Data Backup & Restore

### Export

```typescript
import { exportAllData } from "@/lib/sql/backup";
const snapshot = await exportAllData();
// Save snapshot as JSON file
```

The export includes all business tables in FK-dependency order:
`payment_options → products → orders → order_items → extras → order_item_extras → inventory_items → categories → category_inventory_item → transactions`

`domain_events` are excluded (ephemeral).

### Validate Before Import

```typescript
import { validateSnapshot } from "@/lib/sql/backup";
const errors = validateSnapshot({ data: parsedJSON });
if (errors.length > 0) {
  console.error("Invalid snapshot:", errors);
}
```

### Health Check

```typescript
import { getTableCounts } from "@/lib/sql/backup";
const counts = await getTableCounts();
// { products: 42, orders: 15, ... }
```

---

## Branch Transition / Admin Migration Procedure

When transferring the project to a new admin or deploying to a new environment:

1. **Export data** from the current environment:
   - Call `admin.exportData` or use `exportAllData()` directly.
   - Save the JSON snapshot to a secure location.

2. **Set up the new environment**:
   - Configure `POSTGRES_URL` (or Vercel Postgres env vars).
   - Set `ADMIN_API_KEY` and `SESSION_SECRET`.

3. **Deploy** — the app will automatically run all migrations on first startup.

4. **Validate** — call `admin.migrationStatus` to confirm all migrations applied.

5. **Import data** (if restoring from backup):
   - Validate the snapshot with `admin.validateSnapshot`.
   - Import tables in the order defined by `TABLE_EXPORT_ORDER` in `backup.ts`.

---

## Testing

Migration-related tests live in `lib/sql/__tests__/`:

| Test File | What It Covers |
|-----------|---------------|
| `migrations.test.ts` | Migration structure (versions sequential, no duplicates, all have required fields) |
| `migrate.test.ts` | Runner logic (applies pending, skips applied, stops on failure, status reporting) |
| `backup.test.ts` | Snapshot validation (missing fields, invalid types, error accumulation) |

Run tests:

```bash
npx vitest run lib/sql/__tests__/
```
