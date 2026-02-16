import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock db ──────────────────────────────────────────────────────────────────
const mockExecute = vi.fn();
const mockSelectExecute = vi.fn();
const mockInsertExecute = vi.fn();

vi.mock("@/lib/sql/database", () => ({
  db: {
    schema: {
      createTable: vi.fn(() => ({
        ifNotExists: vi.fn(() => ({
          addColumn: vi.fn(function addColumn() {
            return { addColumn, execute: mockExecute };
          }),
          execute: mockExecute,
        })),
      })),
    },
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        execute: mockSelectExecute,
      })),
    })),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: mockInsertExecute,
      })),
    })),
  },
  sql: new Proxy(() => "", {
    apply: () => "",
    get: () => () => "",
  }),
}));

import type { Migration } from "@/lib/sql/migrate";
import { getMigrationStatus, runMigrations } from "@/lib/sql/migrate";

describe("runMigrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockSelectExecute.mockResolvedValue([]);
    mockInsertExecute.mockResolvedValue(undefined);
  });

  const fakeMigrations: Migration[] = [
    { version: 1, description: "create stuff", up: vi.fn().mockResolvedValue(undefined) },
    { version: 2, description: "add extras", up: vi.fn().mockResolvedValue(undefined) },
  ];

  it("applies all pending migrations when none have been applied", async () => {
    const applied = await runMigrations({ migrations: fakeMigrations });
    expect(applied).toEqual([1, 2]);
    expect(fakeMigrations[0].up).toHaveBeenCalledOnce();
    expect(fakeMigrations[1].up).toHaveBeenCalledOnce();
  });

  it("skips already-applied migrations", async () => {
    // Simulate v1 already applied
    mockSelectExecute.mockResolvedValue([{ version: 1 }]);

    const applied = await runMigrations({ migrations: fakeMigrations });
    expect(applied).toEqual([2]);
    expect(fakeMigrations[0].up).not.toHaveBeenCalled();
    expect(fakeMigrations[1].up).toHaveBeenCalledOnce();
  });

  it("returns empty array when all migrations are current", async () => {
    mockSelectExecute.mockResolvedValue([{ version: 1 }, { version: 2 }]);

    const applied = await runMigrations({ migrations: fakeMigrations });
    expect(applied).toEqual([]);
    expect(fakeMigrations[0].up).not.toHaveBeenCalled();
    expect(fakeMigrations[1].up).not.toHaveBeenCalled();
  });

  it("stops on first failure and throws", async () => {
    const error = new Error("migration failed");
    (fakeMigrations[0].up as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(
      runMigrations({ migrations: fakeMigrations })
    ).rejects.toThrow("migration failed");

    expect(fakeMigrations[1].up).not.toHaveBeenCalled();
  });
});

describe("getMigrationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockSelectExecute.mockResolvedValue([]);
  });

  const fakeMigrations: Migration[] = [
    { version: 1, description: "a", up: vi.fn() },
    { version: 2, description: "b", up: vi.fn() },
    { version: 3, description: "c", up: vi.fn() },
  ];

  it("reports all pending when nothing applied", async () => {
    const status = await getMigrationStatus({ migrations: fakeMigrations });
    expect(status.applied).toEqual([]);
    expect(status.pending).toEqual([1, 2, 3]);
    expect(status.current).toBeNull();
  });

  it("reports correct status when some applied", async () => {
    mockSelectExecute.mockResolvedValue([{ version: 1 }, { version: 2 }]);

    const status = await getMigrationStatus({ migrations: fakeMigrations });
    expect(status.applied).toEqual([1, 2]);
    expect(status.pending).toEqual([3]);
    expect(status.current).toBe(2);
  });

  it("reports no pending when fully up to date", async () => {
    mockSelectExecute.mockResolvedValue([
      { version: 1 },
      { version: 2 },
      { version: 3 },
    ]);

    const status = await getMigrationStatus({ migrations: fakeMigrations });
    expect(status.applied).toEqual([1, 2, 3]);
    expect(status.pending).toEqual([]);
    expect(status.current).toBe(3);
  });
});
