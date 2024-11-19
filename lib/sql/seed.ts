import { CompiledQuery } from "kysely";
import { db, sql } from "./database";
import { importProductsFromJson } from "./functions/importProductsFromJSON";

function createProductTable() {
  return db.schema
    .createTable('products')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamp', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('deleted', 'timestamp', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamp', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('price', 'integer', (col) => col.notNull()) // price in cents
    .addColumn('tags', sql`varchar[]`, (col) => col.notNull())
    .execute()
    .then(() =>
      console.info(`Create "product" table`)
    );
}

function createOrderTable() {
  return db.schema
    .createTable('orders')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('position', 'integer', (col) => col.notNull()) // Order number by day
    .addColumn('closed', 'timestamp', (col) => col.defaultTo(null))
    .addColumn('created', 'timestamp', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('deleted', 'timestamp', (col) => col.defaultTo(null))
    .addColumn('updated', 'timestamp', (col) => col.defaultTo(sql`current_timestamp`))
    .addColumn('products', 'varchar', (col) => col.notNull()) // UUID CSV
    .addColumn('total', 'integer', (col) => col.notNull().defaultTo(0)) // total in cents
    .execute()
    .then(() =>
      console.info(`Create "order" table`)
    );
}

function createOrderItemsTable() {
  return db.schema
    .createTable('order_items')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .addColumn('product_id', 'uuid', (col) => col.notNull().references('products.id'))
    .addColumn('quantity', 'integer', (col) => col.notNull().defaultTo(1))
    .execute()
    .then(() =>
      console.info(`Create "order_items" table`)
    );
}

const calculateOrderTotal = `
CREATE OR REPLACE FUNCTION calculate_order_total() RETURNS TRIGGER AS $$
  BEGIN
    NEW.total := (
      SELECT COALESCE(SUM(p.price * oi.quantity), 0)
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.id
    );
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;
`;

const updateOrderTotal = `
CREATE TRIGGER update_order_total
  AFTER INSERT OR UPDATE OR DELETE
  ON order_items
  FOR EACH ROW
EXECUTE FUNCTION calculate_order_total();
`;

export async function seed() {
  console.info('Start schema creation')
  await createProductTable();
  await createOrderTable();
  await createOrderItemsTable();
  await db.executeQuery(CompiledQuery.raw(`${calculateOrderTotal}`, []))
    .then(() =>
      console.info(`Create "calculate_order_total" function`)
    );
  await db.executeQuery(CompiledQuery.raw(`${updateOrderTotal}`, []))
    .then(() =>
      console.info(`Create "update_order_total" trigger for "calculate_order_total"`)
    );
  await importProductsFromJson();
}  