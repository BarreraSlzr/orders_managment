import { createKysely } from '@vercel/postgres-kysely';
import { Database } from './types';

// Lazy singleton — avoids throwing at import time when POSTGRES_URL is missing
// (e.g. during Next.js build page data collection)
let _db: ReturnType<typeof createKysely<Database>> | null = null;

export function getDb() {
  if (!_db) {
    _db = createKysely<Database>();
  }
  return _db;
}

/** @deprecated Use getDb() for lazy initialization. Kept for backward compat. */
export const db = new Proxy({} as ReturnType<typeof createKysely<Database>>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { sql } from 'kysely';
