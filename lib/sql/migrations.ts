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

// ── v4: Multi-tenant foundation (tenants + users + tenant_id columns) ───────

const migration004: Migration = {
  version: 4,
  description:
    "Add tenants/users tables + tenant_id columns (backfill legacy data)",
  async up() {
    await db.schema
      .createTable("tenants")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("name", "varchar", (col) => col.notNull())
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    await db.schema
      .createIndex("tenants_name_idx")
      .on("tenants")
      .column("name")
      .unique()
      .ifNotExists()
      .execute();

    await db.schema
      .createTable("users")
      .ifNotExists()
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn("tenant_id", "uuid", (col) =>
        col.notNull().references("tenants.id")
      )
      .addColumn("username", "varchar", (col) => col.notNull())
      .addColumn("role", "varchar", (col) =>
        col.notNull().check(sql`role in ('admin', 'manager', 'staff')`)
      )
      .addColumn("password_hash", "varchar", (col) => col.notNull())
      .addColumn("password_salt", "varchar", (col) => col.notNull())
      .addColumn("created", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .addColumn("updated", "timestamptz", (col) =>
        col.defaultTo(sql`now()`)
      )
      .execute();

    await db.schema
      .createIndex("users_tenant_username_idx")
      .on("users")
      .columns(["tenant_id", "username"])
      .unique()
      .ifNotExists()
      .execute();

    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
DECLARE
  default_tenant uuid;
BEGIN
  SELECT id INTO default_tenant FROM tenants WHERE name = 'cafe&baguettes';
  IF default_tenant IS NULL THEN
    INSERT INTO tenants (name) VALUES ('cafe&baguettes')
    RETURNING id INTO default_tenant;
  END IF;

  ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE payment_options ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE extras ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE order_item_extras ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE category_inventory_item ADD COLUMN IF NOT EXISTS tenant_id uuid;
  ALTER TABLE domain_events ADD COLUMN IF NOT EXISTS tenant_id uuid;

  -- Set all to default tenant (both NULL and existing non-matching values)
  UPDATE products SET tenant_id = default_tenant;
  UPDATE orders SET tenant_id = default_tenant;
  UPDATE order_items SET tenant_id = default_tenant;
  UPDATE payment_options SET tenant_id = default_tenant;
  UPDATE extras SET tenant_id = default_tenant;
  UPDATE order_item_extras SET tenant_id = default_tenant;
  UPDATE inventory_items SET tenant_id = default_tenant;
  UPDATE transactions SET tenant_id = default_tenant;
  UPDATE categories SET tenant_id = default_tenant;
  UPDATE category_inventory_item SET tenant_id = default_tenant;
  UPDATE domain_events SET tenant_id = default_tenant;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tenant_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_tenant_id_fkey'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_options_tenant_id_fkey'
  ) THEN
    ALTER TABLE payment_options
      ADD CONSTRAINT payment_options_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extras_tenant_id_fkey'
  ) THEN
    ALTER TABLE extras
      ADD CONSTRAINT extras_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_item_extras_tenant_id_fkey'
  ) THEN
    ALTER TABLE order_item_extras
      ADD CONSTRAINT order_item_extras_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_tenant_id_fkey'
  ) THEN
    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_items_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_tenant_id_fkey'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_tenant_id_fkey'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_inventory_item_tenant_id_fkey'
  ) THEN
    ALTER TABLE category_inventory_item
      ADD CONSTRAINT category_inventory_item_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'domain_events_tenant_id_fkey'
  ) THEN
    ALTER TABLE domain_events
      ADD CONSTRAINT domain_events_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  CREATE INDEX IF NOT EXISTS products_tenant_id_idx ON products(tenant_id);
  CREATE INDEX IF NOT EXISTS orders_tenant_id_idx ON orders(tenant_id);
  CREATE INDEX IF NOT EXISTS order_items_tenant_id_idx ON order_items(tenant_id);
  CREATE INDEX IF NOT EXISTS payment_options_tenant_id_idx ON payment_options(tenant_id);
  CREATE INDEX IF NOT EXISTS extras_tenant_id_idx ON extras(tenant_id);
  CREATE INDEX IF NOT EXISTS order_item_extras_tenant_id_idx ON order_item_extras(tenant_id);
  CREATE INDEX IF NOT EXISTS inventory_items_tenant_id_idx ON inventory_items(tenant_id);
  CREATE INDEX IF NOT EXISTS transactions_tenant_id_idx ON transactions(tenant_id);
  CREATE INDEX IF NOT EXISTS categories_tenant_id_idx ON categories(tenant_id);
  CREATE INDEX IF NOT EXISTS category_inventory_item_tenant_id_idx ON category_inventory_item(tenant_id);
  CREATE INDEX IF NOT EXISTS domain_events_tenant_id_idx ON domain_events(tenant_id);
END $$;
`
      )
    );

    console.info("[v4] Tenants/users + tenant_id columns created.");
  },
};

// ── v5: User permissions for granular RBAC ────────────────────────────────

const migration005: Migration = {
  version: 5,
  description: "Add users.permissions jsonb column (default empty array)",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

  UPDATE users SET permissions = '[]'::jsonb WHERE permissions IS NULL;
END $$;
`
      )
    );

    console.info("[v5] users.permissions column added.");
  },
};

// ── v6: Admin audit logs ───────────────────────────────────────────────────

const migration006: Migration = {
  version: 6,
  description: "Add admin_audit_logs table for persistent admin access logs",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id serial PRIMARY KEY,
    admin_id uuid NOT NULL,
    role varchar,
    action varchar NOT NULL,
    tenant_id uuid,
    target_tenant_id uuid,
    metadata jsonb,
    created timestamptz DEFAULT now()
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_admin_id_fkey'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_tenant_id_fkey'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_target_tenant_id_fkey'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_target_tenant_id_fkey
      FOREIGN KEY (target_tenant_id) REFERENCES tenants(id);
  END IF;

  CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx ON admin_audit_logs(admin_id);
  CREATE INDEX IF NOT EXISTS admin_audit_logs_tenant_id_idx ON admin_audit_logs(tenant_id);
  CREATE INDEX IF NOT EXISTS admin_audit_logs_target_tenant_id_idx ON admin_audit_logs(target_tenant_id);
  CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created);
END $$;
`
      )
    );

    console.info("[v6] admin_audit_logs table created.");
  },
};

// ── v7: Mercado Pago integration ───────────────────────────────────────────

const migration007: Migration = {
  version: 7,
  description: "Add mercadopago_credentials and payment_sync_attempts tables for MP integration",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  -- Mercado Pago credentials (one per tenant)
  CREATE TABLE IF NOT EXISTS mercadopago_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    access_token varchar NOT NULL,
    app_id varchar NOT NULL,
    user_id varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'active',
    error_message text,
    created timestamptz DEFAULT now(),
    updated timestamptz DEFAULT now(),
    deleted timestamptz
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mercadopago_credentials_tenant_id_fkey'
  ) THEN
    ALTER TABLE mercadopago_credentials
      ADD CONSTRAINT mercadopago_credentials_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  CREATE INDEX IF NOT EXISTS mercadopago_credentials_tenant_id_idx ON mercadopago_credentials(tenant_id);
  CREATE INDEX IF NOT EXISTS mercadopago_credentials_status_idx ON mercadopago_credentials(status);

  -- Payment sync attempts (record of each MP sync attempt per order)
  CREATE TABLE IF NOT EXISTS payment_sync_attempts (
    id serial PRIMARY KEY,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    status varchar NOT NULL DEFAULT 'pending',
    terminal_id varchar,
    qr_code text,
    mp_transaction_id varchar,
    amount_cents integer NOT NULL,
    response_data jsonb,
    error_data jsonb,
    created timestamptz DEFAULT now(),
    updated timestamptz DEFAULT now()
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_sync_attempts_tenant_id_fkey'
  ) THEN
    ALTER TABLE payment_sync_attempts
      ADD CONSTRAINT payment_sync_attempts_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_sync_attempts_order_id_fkey'
  ) THEN
    ALTER TABLE payment_sync_attempts
      ADD CONSTRAINT payment_sync_attempts_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id);
  END IF;

  CREATE INDEX IF NOT EXISTS payment_sync_attempts_tenant_id_idx ON payment_sync_attempts(tenant_id);
  CREATE INDEX IF NOT EXISTS payment_sync_attempts_order_id_idx ON payment_sync_attempts(order_id);
  CREATE INDEX IF NOT EXISTS payment_sync_attempts_status_idx ON payment_sync_attempts(status);
  CREATE INDEX IF NOT EXISTS payment_sync_attempts_created_idx ON payment_sync_attempts(created);
END $$;
`
      )
    );

    console.info("[v7] mercadopago_credentials and payment_sync_attempts tables created.");
  },
};

// ── v8: Mercado Pago contact email ─────────────────────────────────────────

const migration008: Migration = {
  version: 8,
  description: "Add contact_email to mercadopago_credentials for client onboarding",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mercadopago_credentials'
      AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE mercadopago_credentials
      ADD COLUMN contact_email varchar;
  END IF;
END $$;
`
      )
    );

    console.info("[v8] mercadopago_credentials contact_email added.");
  },
};

// ── v9: Mercado Pago access requests ───────────────────────────────────────

const migration009: Migration = {
  version: 9,
  description: "Add mercadopago_access_requests to track OAuth access requests",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS mercadopago_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    contact_email varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'pending',
    requested_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mp_access_requests_tenant_id_fkey'
  ) THEN
    ALTER TABLE mercadopago_access_requests
      ADD CONSTRAINT mp_access_requests_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;

  CREATE INDEX IF NOT EXISTS mp_access_requests_tenant_id_idx ON mercadopago_access_requests(tenant_id);
  CREATE INDEX IF NOT EXISTS mp_access_requests_status_idx ON mercadopago_access_requests(status);
  CREATE INDEX IF NOT EXISTS mp_access_requests_requested_at_idx ON mercadopago_access_requests(requested_at);
END $$;
`
      )
    );

    console.info("[v9] mercadopago_access_requests table created.");
  },
};

// ── v10: Product compositions ─────────────────────────────────────────────

const migration010: Migration = {
  version: 10,
  description:
    "Add product_consumptions table — links products to inventory items with quantity + unit",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS product_consumptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id),
    product_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    quantity_type_value varchar NOT NULL,
    is_takeaway boolean NOT NULL DEFAULT false,
    created timestamptz NOT NULL DEFAULT now(),
    updated timestamptz NOT NULL DEFAULT now(),
    deleted timestamptz
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_consumptions_product_id_fkey'
  ) THEN
    ALTER TABLE product_consumptions
      ADD CONSTRAINT product_consumptions_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_consumptions_item_id_fkey'
  ) THEN
    ALTER TABLE product_consumptions
      ADD CONSTRAINT product_consumptions_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
  END IF;

  CREATE INDEX IF NOT EXISTS product_consumptions_product_id_idx ON product_consumptions(product_id);
  CREATE INDEX IF NOT EXISTS product_consumptions_item_id_idx ON product_consumptions(item_id);
  CREATE INDEX IF NOT EXISTS product_consumptions_tenant_id_idx ON product_consumptions(tenant_id);
END $$;
`
      )
    );

    console.info("[v10] product_consumptions table created.");
  },
};

// ── v11: Inventory min_stock threshold + EOD reconciliation support ──────────

const migration011: Migration = {
  version: 11,
  description:
    "Add min_stock column to inventory_items for low-stock alerts",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT NULL;`
      )
    );
    console.info("[v11] min_stock column added to inventory_items.");
  },
};

// ── v12: Mercado Pago token lifecycle fields ───────────────────────────────

const migration012: Migration = {
  version: 12,
  description:
    "Add refresh_token and token expiry tracking fields to mercadopago_credentials",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mercadopago_credentials'
      AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE mercadopago_credentials
      ADD COLUMN refresh_token varchar;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mercadopago_credentials'
      AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE mercadopago_credentials
      ADD COLUMN token_expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mercadopago_credentials'
      AND column_name = 'refreshed_at'
  ) THEN
    ALTER TABLE mercadopago_credentials
      ADD COLUMN refreshed_at timestamptz;
  END IF;
END $$;
`
      )
    );

    console.info("[v12] mercadopago_credentials refresh token fields added.");
  },
};

// ── v13: Platform subscription + entitlement domain ─────────────────────────

const migration013: Migration = {
  version: 13,
  description:
    "Add tenant_subscriptions, tenant_entitlements, tenant_billing_events for entitlement soft-gate",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                TEXT NOT NULL,
  provider                 TEXT NOT NULL,
  external_subscription_id TEXT,
  status                   TEXT NOT NULL DEFAULT 'none',
  current_period_end       TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  metadata                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscriptions_active_uniq
  ON tenant_subscriptions (tenant_id, provider)
  WHERE status NOT IN ('canceled', 'expired');

CREATE TABLE IF NOT EXISTS tenant_entitlements (
  tenant_id           TEXT PRIMARY KEY,
  subscription_status TEXT NOT NULL DEFAULT 'none',
  features_enabled    TEXT[] NOT NULL DEFAULT '{}',
  grace_period_end    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_billing_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_billing_events_tenant_id_idx
  ON tenant_billing_events (tenant_id);
`
      )
    );

    console.info(
      "[v13] tenant_subscriptions, tenant_entitlements, tenant_billing_events created.",
    );
  },
};

// ── v14: Idempotency columns on payment_sync_attempts ────────────────────────

const migration014: Migration = {
  version: 14,
  description:
    "Add last_mp_notification_id and last_processed_at to payment_sync_attempts for webhook deduplication",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_sync_attempts'
      AND column_name = 'last_mp_notification_id'
  ) THEN
    ALTER TABLE payment_sync_attempts
      ADD COLUMN last_mp_notification_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_sync_attempts'
      AND column_name = 'last_processed_at'
  ) THEN
    ALTER TABLE payment_sync_attempts
      ADD COLUMN last_processed_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_sync_attempts_notification_id_idx
  ON payment_sync_attempts (last_mp_notification_id)
  WHERE last_mp_notification_id IS NOT NULL;
`
      )
    );

    console.info(
      "[v14] payment_sync_attempts idempotency columns (last_mp_notification_id, last_processed_at) added.",
    );
  },
};

// ── v15: Billing event deduplication — external_event_id ─────────────────────

const migration015: Migration = {
  version: 15,
  description:
    "Add external_event_id to tenant_billing_events for webhook deduplication",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_billing_events'
      AND column_name = 'external_event_id'
  ) THEN
    ALTER TABLE tenant_billing_events
      ADD COLUMN external_event_id TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_external_event_id
  ON tenant_billing_events (external_event_id)
  WHERE external_event_id IS NOT NULL;
`
      )
    );

    console.info(
      "[v15] tenant_billing_events.external_event_id column + unique partial index added.",
    );
  },
};

// ── v16: platform_alerts — cross-scope notification store ────────────────────

const migration016: Migration = {
  version: 16,
  description:
    "Add platform_alerts table for claims, subscription events and changelog notices",
  async up() {
    await db.executeQuery(
      CompiledQuery.raw(
        `
CREATE TABLE IF NOT EXISTS platform_alerts (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   TEXT        NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope       TEXT        NOT NULL DEFAULT 'tenant', -- 'tenant' | 'admin'
  type        TEXT        NOT NULL,                  -- 'claim' | 'subscription' | 'changelog' | 'system'
  severity    TEXT        NOT NULL DEFAULT 'info',   -- 'info' | 'warning' | 'critical'
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  source_type TEXT        NULL,                      -- 'mp_claim' | 'mp_subscription' | 'changelog'
  source_id   TEXT        NULL,                      -- external id for drill-down
  metadata    JSONB       NULL,
  read_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_alerts_tenant_id_idx
  ON platform_alerts (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_alerts_scope_type_idx
  ON platform_alerts (scope, type, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_alerts_unread_idx
  ON platform_alerts (tenant_id, created_at DESC)
  WHERE read_at IS NULL;
`
      )
    );

    console.info("[v16] platform_alerts table created.");
  },
};

// ── Export all migrations ────────────────────────────────────────────────────

export const allMigrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
  migration015,
  migration016,
];
