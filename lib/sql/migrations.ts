/**
 * All database migrations for orders_managment.
 *
 * RULES:
 * - Every migration MUST be idempotent (IF NOT EXISTS, CREATE OR REPLACE).
 * - Never modify a migration after it has been deployed — create a new one.
 * - Migrations run inside the same connection but NOT inside an explicit
 *   transaction (Vercel Postgres limitations). Keep them small and safe.
 */

import { CompiledQuery } from "kysely";
import { db, sql } from "./database";
import { importProductsFromJson } from "./functions/importProductsFromJSON";
import { Migration } from "./migrate";

// ── v1: Baseline schema (all tables that existed before migration system) ────

const migration001: Migration = {
  version: 1,
  description:
    "Baseline — products, orders, order_items, payment_options, inventory, categories, transactions, domain_events",
  async up() {
    // payment_options (no FK deps)
    await db.schema
      .createTable("payment_options")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    // Seed payment options
    const noRows = (
      await db.executeQuery<{ count: string }>(
        CompiledQuery.raw("SELECT count(id)::text AS count FROM payment_options")
      )
    ).rows.some(({ count }) => count === "0");
    if (noRows) {
      await db
        .insertInto("payment_options")
        .values([
          { name: "Cash" },
          { name: "Transfer" },
          { name: "Credit Card" },
          { name: "Debit Card" },
          { name: "Mobile Payment" },
          { name: "Cryptocurrency" },
        ])
        .execute();
    }

    // products
    await db.schema
      .createTable("products")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("deleted", "timestamptz", (col) => col.defaultTo(null))
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("price", "integer", (col) => col.notNull())
      .addColumn("tags", sql`varchar`, (col) => col.notNull())
      .execute();

    // orders
    await db.schema
      .createTable("orders")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("position", "integer", (col) => col.notNull())
      .addColumn("closed", "timestamptz", (col) => col.defaultTo(null))
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("deleted", "timestamptz", (col) => col.defaultTo(null))
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("total", "integer", (col) => col.notNull().defaultTo(0))
      .execute();

    // order_items
    await db.schema
      .createTable("order_items")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("order_id", "uuid", (col) =>
        col.notNull().references("orders.id").onDelete("cascade")
      )
      .addColumn("product_id", "uuid", (col) =>
        col.notNull().references("products.id")
      )
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("is_takeaway", "boolean", (col) =>
        col.notNull().defaultTo(false)
      )
      .addColumn("payment_option_id", "serial", (col) =>
        col.notNull().references("payment_option.id").defaultTo(1)
      )
      .execute();

    // inventory_items
    await db.schema
      .createTable("inventory_items")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("status", "varchar", (col) =>
        col
          .notNull()
          .check(sql`status in ('pending', 'completed')`)
      )
      .addColumn("quantity_type_key", "varchar", (col) => col.notNull())
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("deleted", "timestamptz")
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    // categories
    await db.schema
      .createTable("categories")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("created", "timestamp", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("deleted", "timestamp")
      .addColumn("updated", "timestamp", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    // category_inventory_item
    await db.schema
      .createTable("category_inventory_item")
      .ifNotExists()
      .addColumn("category_id", "uuid", (col) =>
        col.notNull().references("categories.id")
      )
      .addColumn("item_id", "uuid", (col) =>
        col.notNull().references("inventory_items.id")
      )
      .execute();

    // transactions
    await db.schema
      .createTable("transactions")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("item_id", "uuid", (col) =>
        col.notNull().references("inventory_items.id")
      )
      .addColumn("type", "varchar", (col) =>
        col.notNull().check(sql`type in ('IN', 'OUT')`)
      )
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("price", "decimal", (col) => col.notNull())
      .addColumn("quantity", "integer", (col) => col.notNull())
      .addColumn("quantity_type_value", "varchar", (col) => col.notNull())
      .execute();

    // domain_events
    await db.schema
      .createTable("domain_events")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("event_type", "varchar", (col) => col.notNull())
      .addColumn("payload", "jsonb", (col) => col.notNull())
      .addColumn("status", "varchar", (col) =>
        col
          .notNull()
          .defaultTo("pending")
          .check(sql`status in ('pending', 'processed', 'failed')`)
      )
      .addColumn("result", "jsonb")
      .addColumn("error_message", "text")
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    // Seed products from JSON if empty
    await importProductsFromJson();

    console.info("[v1] Baseline schema applied.");
  },
};

// ── v2: Extras tables ────────────────────────────────────────────────────────

const migration002: Migration = {
  version: 2,
  description: "Add extras catalog + order_item_extras junction table",
  async up() {
    await db.schema
      .createTable("extras")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("price", "integer", (col) => col.notNull())
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("deleted", "timestamptz", (col) => col.defaultTo(null))
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    await db.schema
      .createTable("order_item_extras")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("order_item_id", "integer", (col) =>
        col
          .notNull()
          .references("order_items.id")
          .onDelete("cascade")
      )
      .addColumn("extra_id", "uuid", (col) =>
        col.notNull().references("extras.id")
      )
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    console.info("[v2] Extras tables created.");
  },
};

// ── v3: Triggers — order total calculation + extras total ────────────────────

const migration003: Migration = {
  version: 3,
  description:
    "Install/update calculate_order_total + extras triggers + pg_notify",
  async up() {
    // Order total trigger (includes extras in calculation)
    await db.executeQuery(
      CompiledQuery.raw(
        `
CREATE OR REPLACE FUNCTION calculate_order_total() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.order_id IS NOT NULL THEN
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(p.price), 0)
        + COALESCE((
            SELECT SUM(e.price)
            FROM order_item_extras oie
            JOIN extras e ON oie.extra_id = e.id
            WHERE oie.order_item_id IN (
              SELECT oi2.id FROM order_items oi2 WHERE oi2.order_id = OLD.order_id
            )
          ), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = OLD.order_id
    )
    WHERE id = OLD.order_id;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.order_id IS NOT NULL THEN
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(p.price), 0)
        + COALESCE((
            SELECT SUM(e.price)
            FROM order_item_extras oie
            JOIN extras e ON oie.extra_id = e.id
            WHERE oie.order_item_id IN (
              SELECT oi2.id FROM order_items oi2 WHERE oi2.order_id = NEW.order_id
            )
          ), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
`,
        []
      )
    );

    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_total') THEN
    CREATE TRIGGER update_order_total
    AFTER INSERT OR DELETE OR UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION calculate_order_total();
  END IF;
END $$;
`,
        []
      )
    );

    // Extras trigger
    await db.executeQuery(
      CompiledQuery.raw(
        `
CREATE OR REPLACE FUNCTION calculate_order_total_from_extras() RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT oi.order_id INTO v_order_id FROM order_items oi WHERE oi.id = OLD.order_item_id;
  ELSE
    SELECT oi.order_id INTO v_order_id FROM order_items oi WHERE oi.id = NEW.order_item_id;
  END IF;

  IF v_order_id IS NOT NULL THEN
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(p.price), 0)
        + COALESCE((
            SELECT SUM(e.price)
            FROM order_item_extras oie
            JOIN extras e ON oie.extra_id = e.id
            WHERE oie.order_item_id IN (
              SELECT oi2.id FROM order_items oi2 WHERE oi2.order_id = v_order_id
            )
          ), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = v_order_id
    )
    WHERE id = v_order_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
`,
        []
      )
    );

    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_total_from_extras') THEN
    CREATE TRIGGER update_order_total_from_extras
    AFTER INSERT OR DELETE ON order_item_extras
    FOR EACH ROW EXECUTE FUNCTION calculate_order_total_from_extras();
  END IF;
END $$;
`,
        []
      )
    );

    // pg_notify trigger for SSE cache invalidation
    await db.executeQuery(
      CompiledQuery.raw(
        `
CREATE OR REPLACE FUNCTION notify_table_change() RETURNS TRIGGER AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'id', COALESCE(NEW.id, OLD.id)
  );
  PERFORM pg_notify('table_changes', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
`,
        []
      )
    );

    const notifyTables = [
      "orders",
      "order_items",
      "products",
      "extras",
      "order_item_extras",
      "inventory_items",
      "categories",
      "transactions",
    ];

    for (const table of notifyTables) {
      await db.executeQuery(
        CompiledQuery.raw(
          `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${table}_notify') THEN
    CREATE TRIGGER ${table}_notify
    AFTER INSERT OR UPDATE OR DELETE ON ${table}
    FOR EACH ROW EXECUTE FUNCTION notify_table_change();
  END IF;
END $$;
`,
          []
        )
      );
    }

    console.info("[v3] All triggers installed.");
  },
};

// ── Export all migrations ────────────────────────────────────────────────────

export const allMigrations: Migration[] = [
  migration001,
  migration002,
  migration003,
];
