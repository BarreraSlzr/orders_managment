import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
let updateWhereCalls: any[][] = [];

vi.mock("@/lib/sql/database", async (importOriginal) => {
  // Preserve real exports (including `sql` re-exported from kysely if any)
  const actual = await importOriginal<typeof import("@/lib/sql/database")>();

  return {
    ...actual,
    db: {
      selectFrom: vi.fn(() => {
        const where = vi.fn(function where() {
          return {
            where,
            selectAll: vi.fn(() => ({
              where,
              orderBy: vi.fn(() => ({ execute: mockSelect })),
              execute: mockSelect,
            })),
            orderBy: vi.fn(() => ({ execute: mockSelect })),
            execute: mockSelect,
          };
        });

        return {
          select: vi.fn(() => ({
            where,
            orderBy: vi.fn(() => ({ execute: mockSelect })),
            execute: mockSelect,
          })),
          where,
          selectAll: vi.fn(() => ({
            where,
            orderBy: vi.fn(() => ({ execute: mockSelect })),
            execute: mockSelect,
          })),
        };
      }),
      updateTable: vi.fn(() => {
        const where = vi.fn(function where(...args: any[]) {
          updateWhereCalls.push(args);
          return {
            where,
            returning: vi.fn(() => ({ executeTakeFirstOrThrow: mockUpdate })),
          };
        });

        return {
          set: vi.fn(() => ({
            where,
          })),
        };
      }),
    },
  };
});

import { getProducts } from "@/lib/sql/functions/getProducts";
import { getOrders } from "@/lib/sql/functions/getOrders";
import { updateUserPermissions } from "@/lib/sql/functions/users";

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockResolvedValue([]);
  mockUpdate.mockResolvedValue({ id: "u1", permissions: [] });
  updateWhereCalls = [];
});

describe("tenant scoping", () => {
  it("getProducts always scopes by tenant_id", async () => {
    await getProducts({ tenantId: "t1" });

    const selectFrom = (await import("@/lib/sql/database")).db.selectFrom as any;
    const whereCalls = selectFrom.mock.results[0].value.where.mock.calls;
    const tenantWhere = whereCalls.find((call: any[]) => call[0] === "tenant_id");
    expect(tenantWhere[2]).toBe("t1");
  });

  it("getOrders always scopes by tenant_id", async () => {
    await getOrders({ tenantId: "t2" });

    const selectFrom = (await import("@/lib/sql/database")).db.selectFrom as any;
    const whereCalls = selectFrom.mock.results[0].value.where.mock.calls;
    const tenantWhere = whereCalls.find((call: any[]) => call[0] === "tenant_id");
    expect(tenantWhere[2]).toBe("t2");
  });

  it("updateUserPermissions scopes update by tenant_id", async () => {
    await updateUserPermissions({ tenantId: "t3", userId: "u1", permissions: [] });

    const tenantWhere = updateWhereCalls.find((call) => call[0] === "tenant_id");
    expect(tenantWhere).toBeDefined();
    expect(tenantWhere![2]).toBe("t3");
  });
});
