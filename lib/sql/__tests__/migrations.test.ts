import { allMigrations } from "@/lib/sql/migrations";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the database to avoid real DB calls ─────────────────────────────────
const { mockExecute, mockExecuteQuery, mockExecuteTakeFirst } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockExecuteQuery: vi.fn(),
  mockExecuteTakeFirst: vi.fn(),
}));

vi.mock("@/lib/sql/database", () => ({
  db: {
    schema: {
      createTable: vi.fn(() => ({
        ifNotExists: vi.fn(() => ({
          addColumn: vi.fn(function addColumn() {
            return {
              addColumn,
              addPrimaryKeyConstraint: vi.fn(() => ({
                execute: mockExecute,
              })),
              execute: mockExecute,
            };
          }),
          execute: mockExecute,
        })),
      })),
    },
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue([]),
      })),
      selectAll: vi.fn(() => ({
        where: vi.fn(function where() {
          return { where, orderBy: vi.fn(() => ({ execute: vi.fn().mockResolvedValue([]) })), execute: vi.fn().mockResolvedValue([]) };
        }),
        orderBy: vi.fn(() => ({
          execute: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue([]),
        returning: vi.fn(() => ({
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 1 }),
        })),
        returningAll: vi.fn(() => ({
          executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),
        })),
      })),
    })),
    executeQuery: mockExecuteQuery,
  },
  sql: new Proxy(() => "", {
    apply: () => "",
    get: () => () => "",
  }),
}));

vi.mock("@/lib/sql/functions/importProductsFromJSON", () => ({
  importProductsFromJson: vi.fn().mockResolvedValue(undefined),
}));

describe("migrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockExecuteQuery.mockResolvedValue({ rows: [] });
  });

  it("allMigrations is an array of at least 3 migrations", () => {
    expect(Array.isArray(allMigrations)).toBe(true);
    expect(allMigrations.length).toBeGreaterThanOrEqual(3);
  });

  it("each migration has version, description, and up function", () => {
    for (const m of allMigrations) {
      expect(typeof m.version).toBe("number");
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
      expect(typeof m.up).toBe("function");
    }
  });

  it("migration versions are monotonically increasing", () => {
    for (let i = 1; i < allMigrations.length; i++) {
      expect(allMigrations[i].version).toBeGreaterThan(
        allMigrations[i - 1].version
      );
    }
  });

  it("migration versions are sequential starting from 1", () => {
    allMigrations.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
    });
  });

  it("no duplicate versions exist", () => {
    const versions = allMigrations.map((m) => m.version);
    const unique = new Set(versions);
    expect(unique.size).toBe(versions.length);
  });
});
