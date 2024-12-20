import { CompiledQuery } from "kysely";
import { db, sql } from "./database";
import { importProductsFromJson } from "./functions/importProductsFromJSON";

function createProductTable() {
  return db.schema
    .createTable('products')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('price', 'integer', (col) => col.notNull()) // price in cents
    .addColumn('tags', sql`varchar`, (col) => col.notNull())
    .execute()
    .then(() =>
      console.info(`Created "product" table`)
    );
}

function createOrderTable() {
  return db.schema
    .createTable('orders')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('position', 'integer', (col) => col.notNull()) // Order number by day
    .addColumn('closed', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('total', 'integer', (col) => col.notNull().defaultTo(0)) // total in cents
    .execute()
    .then(() =>
      console.info(`Created "order" table`)
    );
}

function createOrderItemsTable() {
  return db.schema
    .createTable('order_items')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .addColumn('product_id', 'uuid', (col) => col.notNull().references('products.id'))
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('is_takeaway', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('payment_option_id', 'serial', (col) => col.notNull().references('payment_option.id').defaultTo(1))
    .execute()
    .then(() =>
      console.info(`Created "order_items" table`)
    );
}

function createPaymentOptionsTable() {
  return db.schema
    .createTable('payment_options')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull()) // e.g., "cash", "transfer", etc.
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .execute()
    .then(() => console.info(`Created "payment_options" table`));
}

async function populatePaymentOptionsIfEmpty() {
  const paymentOptions = [
    { name: 'Cash' },
    { name: 'Transfer' },
    { name: 'Credit Card' },
    { name: 'Debit Card' },
    { name: 'Mobile Payment' }, // e.g., Apple Pay, Google Pay
    { name: 'Cryptocurrency' },
  ];

  const noRows = (await db.executeQuery<{ count: number }>(CompiledQuery.raw(`SELECT count(id) FROM payment_options`))).rows.some(({ count }) => count === 0)

  if (noRows) {
    await db
      .insertInto('payment_options')
      .values(paymentOptions)
      .execute();
    console.info(`Populated "payment_options" table with default entries`);
  } else {
    console.info(`"payment_options" table already populated. Skipping.`);
  }
}

export async function createInventoryItemsTable() {
  await db.schema
    .createTable('inventory_items')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col.notNull().check(sql`status in ('pending', 'completed')`))
    .addColumn('quantity_type_key', 'varchar', (col) => col.notNull())
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamptz')
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .execute()
    .then(() => console.info(`Created "inventory_items" table`));
}

export async function createCategoriesTable() {
  await db.schema
    .createTable('categories')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('created', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamp')
    .addColumn('updated', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .execute()
    .then(() => console.info(`Created "categories" table`));
}

export async function createCategoryInventoryItemTable() {
  await db.schema
    .createTable('category_inventory_item')
    .ifNotExists()
    .addColumn('category_id', 'uuid', (col) => col.notNull().references('categories.id'))
    .addColumn('item_id', 'uuid', (col) => col.notNull().references('inventory_items.id'))
    .execute()
    .then(() => console.info(`Created "category_inventory_item" table`));
}

export async function createTransactionsTable() {
  await db.schema
    .createTable('transactions')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('item_id', 'uuid', (col) => col.notNull().references('inventory_items.id'))
    .addColumn('type', 'varchar', (col) => col.notNull().check(sql`type in ('IN', 'OUT')`))
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('price', 'decimal', (col) => col.notNull())
    .addColumn('quantity', 'integer', (col) => col.notNull())
    .addColumn('quantity_type_value', 'varchar', (col) => col.notNull())
    .execute()
    .then(() => console.info(`Created "transactions" table`));
}

export async function createProductConsumptionsTable() {
  await db.schema
    .createTable('product_consumptions')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('product_id', 'uuid', (col) => col.notNull().references('products.id'))
    .addColumn('item_id', 'uuid', (col) => col.notNull().references('inventory_items.id'))
    .addColumn('is_takeaway', 'boolean', (col) => col.defaultTo(false))
    .addColumn('quantity', 'integer', (col) => col.notNull())
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamptz')
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .execute()
    .then(() => console.info(`Created "product_consumptions" table`));
}

export async function createSuppliersTable() {
  await db.schema
    .createTable('suppliers')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('contact_email', 'varchar')
    .addColumn('contact_phone', 'varchar')
    .addColumn('contact_address', 'varchar')
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .addColumn('deleted', 'timestamptz')
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`now()`))
    .execute()
    .then(() => console.info(`Created "suppliers" table`));
}

export async function createSuppliersItemTable() {
  await db.schema
    .createTable('suppliers_item')
    .ifNotExists()
    .addColumn('item_id', 'uuid', (col) => col.notNull().references('inventory_items.id'))
    .addColumn('supplier_id', 'uuid', (col) => col.notNull().references('suppliers.id'))
    .addPrimaryKeyConstraint('supplier_item_id', ['item_id', 'supplier_id'])
    .execute()
    .then(() => console.info(`Created "suppliers_item" table`));
}

const calculateOrderTotal = `
CREATE OR REPLACE FUNCTION calculate_order_total() RETURNS TRIGGER AS $$
BEGIN
  -- Update total for the old order if applicable
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.order_id IS NOT NULL THEN
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(p.price), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = OLD.order_id
    )
    WHERE id = OLD.order_id;
  END IF;

  -- Update total for the new order if applicable
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.order_id IS NOT NULL THEN
    UPDATE orders
    SET total = (
      SELECT COALESCE(SUM(p.price), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
  END IF;

  RETURN NULL; -- Triggers that do not modify data should return NULL
END;
$$ LANGUAGE plpgsql;
`;

const updateOrderTotal = `
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_order_total'
    ) THEN
        CREATE TRIGGER update_order_total
        AFTER INSERT OR DELETE OR UPDATE
        ON order_items
        FOR EACH ROW
        EXECUTE FUNCTION calculate_order_total();
    END IF;
END $$;
`;

export async function seed() {
  console.info('Start schema creation')
  return Promise.all([
    createPaymentOptionsTable(),
    populatePaymentOptionsIfEmpty(),
    createProductTable(),
    createOrderTable(),
    createOrderItemsTable(),
    await createInventoryItemsTable(),
    await createTransactionsTable(),
    await createCategoriesTable(),
    await createCategoryInventoryItemTable(),
    // createProductConsumptionsTable(),
    // createSuppliersTable(),
    // createSuppliersItemTable(),
    db.executeQuery(CompiledQuery.raw(`${calculateOrderTotal}`, []))
      .then(() =>
        console.info(`Created "calculate_order_total" function`)
      ),
    db.executeQuery(CompiledQuery.raw(`${updateOrderTotal}`, []))
      .then(() =>
        console.info(`Created "update_order_total" trigger for "calculate_order_total"`)
      ),
    importProductsFromJson(),
  ]).then(() => console.info("DB schema finished"))
}  