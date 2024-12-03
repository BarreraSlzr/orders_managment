import { CompiledQuery } from "kysely";
import { db, sql } from "./database";
import { importProductsFromJson } from "./functions/importProductsFromJSON";

function createProductTable() {
  return db.schema
    .createTable('products')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('deleted', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`current_timestamp`))
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
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('deleted', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamptz', (col) => col.defaultTo(sql`current_timestamp`))
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
    .addColumn('created', 'timestamp', (col) => col.defaultTo(sql`current_timestamp`))
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
    .addColumn('created', 'timestamptz', (col) => col.defaultTo(sql`current_timestamp`))
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

  const noRows = (await db.executeQuery<{count: number}>(CompiledQuery.raw(`SELECT count(id) FROM payment_options`))).rows.some(({count}) => count === 0)
    
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


// SCHEMA UPDATES
function updateOrderItemsTable() {
  return db.schema
    .alterTable('order_items')
    .addColumn('is_takeaway', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('payment_option_id', 'serial', (col) => col.notNull().references('payment_options.id'))
    .execute()
    .then(() => console.info(`Updated "order_items" table with is_takeaway and payment_option_id column`));
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
    //updateOrderItemsTable(),
    createProductTable(),
    createOrderTable(),
    createOrderItemsTable(),
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