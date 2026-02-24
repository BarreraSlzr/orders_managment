/**
 * Unit tests for checkEntitlement edge-case fix:
 *  - C2: Grace period auto-expire write-through on read
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockExecuteTakeFirst = vi.fn();
const mockExecute = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/sql/database", () => ({
  db: {
    selectFrom: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: mockExecuteTakeFirst,
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: mockExecute,
          })),
        })),
      })),
    })),
  },
}));

import { db } from "@/lib/sql/database";
import { checkMpEntitlement } from "../checkEntitlement";

describe("checkMpEntitlement (C2 — grace period auto-expire)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENTITLEMENT_ENABLED = "true";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns allowed:true when entitlement is disabled", async () => {
    process.env.ENTITLEMENT_ENABLED = "false";

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("entitlement_disabled");
  });

  it("returns allowed:false reason:none when no entitlement row exists", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("none");
  });

  it("returns allowed:true for active status", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "active",
      grace_period_end: null,
    });

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(true);
  });

  it("returns allowed:true for grace_period with future end date", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "grace_period",
      grace_period_end: futureDate.toISOString(),
    });

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(true);
  });

  it("returns allowed:false reason:expired for grace_period with past end date", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "grace_period",
      grace_period_end: pastDate.toISOString(),
    });

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("fires a write-through DB update when grace period has expired", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "grace_period",
      grace_period_end: pastDate.toISOString(),
    });

    await checkMpEntitlement({ tenantId: "t-1" });

    // Give the fire-and-forget promise a chance to settle
    await new Promise((r) => setTimeout(r, 10));

    // updateTable should have been called to advance the row to "expired"
    expect(db.updateTable).toHaveBeenCalledWith("tenant_entitlements");
  });

  it("returns allowed:false for canceled status", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "canceled",
      grace_period_end: null,
    });

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("canceled");
  });

  it("returns allowed:false for expired status", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce({
      subscription_status: "expired",
      grace_period_end: null,
    });

    const result = await checkMpEntitlement({ tenantId: "t-1" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });
});
