/**
 * Unit tests for admin tRPC router — mpEnvStatus + mpCredentialHealth + mpCredentialUpsert
 *
 * Coverage targets:
 *  - mpEnvStatus returns deterministic { ok, vars } from process.env
 *  - mpEnvStatus never throws for any env configuration
 *  - adminProcedure rejects unauthenticated callers with UNAUTHORIZED
 *  - mpCredentialHealth returns correct summary and inactiveUserIds
 *  - mpCredentialUpsert inserts/updates and returns non-sensitive row
 */
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ──────────────────────────────────────────────────────────────────

const mockRows: unknown[] = [];
let mockUpsertResult: unknown = null;

vi.mock("@/lib/sql/database", () => {
  const chainable = () => ({
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    whereRef: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn(() => Promise.resolve(mockRows)),
    executeTakeFirst: vi.fn(() => Promise.resolve(mockRows[0])),
    executeTakeFirstOrThrow: vi.fn(() => Promise.resolve(mockUpsertResult)),
  });
  return {
    getDb: vi.fn(() => ({
      selectFrom: vi.fn(chainable),
      updateTable: vi.fn(chainable),
      insertInto: vi.fn(chainable),
    })),
    sql: vi.fn(),
  };
});

vi.mock("@/lib/events/dispatch", () => ({
  dispatchDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { createCallerFactory } from "@/lib/trpc/init";
import { adminRouter } from "@/lib/trpc/routers/admin";

const createCaller = createCallerFactory(adminRouter);

function adminCtx() {
  return {
    session: { sub: "admin-user", iat: 0, exp: 9_999_999_999, role: "admin" as const, tenant_id: "t-admin" },
    isAdmin: true,
  };
}

function guestCtx() {
  return {
    session: null as null,
    isAdmin: false,
  };
}

// ── mpEnvStatus ──────────────────────────────────────────────────────────────

describe("admin.mpEnvStatus", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate env mutations per test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns true only for keys that are non-empty strings", async () => {
    process.env.MP_CLIENT_ID = "test-id";
    process.env.MP_CLIENT_SECRET = "test-secret";
    delete process.env.MP_REDIRECT_URI;
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MP_BILLING_WEBHOOK_SECRET;
    delete process.env.MP_TOKENS_ENCRYPTION_KEY;

    const caller = createCaller(adminCtx());
    const result = await caller.mpEnvStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.vars.MP_CLIENT_ID).toBe(true);
    expect(result.vars.MP_CLIENT_SECRET).toBe(true);
    expect(result.vars.MP_REDIRECT_URI).toBe(false);
    expect(result.vars.MP_WEBHOOK_SECRET).toBe(false);
    expect(result.vars.MP_BILLING_WEBHOOK_SECRET).toBe(false);
    expect(result.vars.MP_TOKENS_ENCRYPTION_KEY).toBe(false);
  });

  it("returns all true when all keys are set", async () => {
    process.env.MP_CLIENT_ID = "id";
    process.env.MP_CLIENT_SECRET = "secret";
    process.env.MP_REDIRECT_URI = "https://example.com/api/mercadopago/webhook";
    process.env.MP_WEBHOOK_SECRET = "whsec";
    process.env.MP_BILLING_WEBHOOK_SECRET = "billsec";
    process.env.MP_TOKENS_ENCRYPTION_KEY = "enckey";

    const caller = createCaller(adminCtx());
    const result = await caller.mpEnvStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.values(result.vars).every(Boolean)).toBe(true);
  });

  it("returns all false when no MP env vars are set", async () => {
    for (const key of [
      "MP_CLIENT_ID",
      "MP_CLIENT_SECRET",
      "MP_REDIRECT_URI",
      "MP_WEBHOOK_SECRET",
      "MP_BILLING_WEBHOOK_SECRET",
      "MP_TOKENS_ENCRYPTION_KEY",
    ]) {
      delete process.env[key];
    }

    const caller = createCaller(adminCtx());
    const result = await caller.mpEnvStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.values(result.vars).every((v) => v === false)).toBe(true);
  });

  it("returns false for whitespace-only values", async () => {
    process.env.MP_CLIENT_ID = "   ";
    process.env.MP_CLIENT_SECRET = "";

    const caller = createCaller(adminCtx());
    const result = await caller.mpEnvStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.vars.MP_CLIENT_ID).toBe(false);
    expect(result.vars.MP_CLIENT_SECRET).toBe(false);
  });

  it("throws UNAUTHORIZED for non-admin caller", async () => {
    const caller = createCaller(guestCtx());

    await expect(caller.mpEnvStatus()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });

  it("never throws for any env configuration — returns deterministic payload", async () => {
    delete process.env.MP_CLIENT_ID;

    const caller = createCaller(adminCtx());
    await expect(caller.mpEnvStatus()).resolves.toBeDefined();
  });
});

// ── mpCredentialHealth ───────────────────────────────────────────────────────

describe("admin.mpCredentialHealth", () => {
  afterEach(() => {
    vi.resetAllMocks();
    mockRows.length = 0;
  });

  it("returns empty summary when no credentials exist", async () => {
    mockRows.length = 0;

    const caller = createCaller(adminCtx());
    const result = await caller.mpCredentialHealth();

    expect(result.rows).toHaveLength(0);
    expect(result.activeCount).toBe(0);
    expect(result.inactiveUserIds).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("computes activeCount from status=active + deleted=null rows", async () => {
    const now = new Date();
    mockRows.push(
      {
        id: "1",
        tenant_id: "t-foo",
        user_id: "204005478",
        app_id: "app1",
        contact_email: "foo@bar.com",
        status: "active",
        deleted: null,
        created: now,
        error_message: null,
      },
      {
        id: "2",
        tenant_id: "t-foo",
        user_id: "204005478",
        app_id: "app1",
        contact_email: "foo@bar.com",
        status: "inactive",
        deleted: null,
        created: now,
        error_message: null,
      },
    );

    const caller = createCaller(adminCtx());
    const result = await caller.mpCredentialHealth();

    expect(result.activeCount).toBe(1);
    expect(result.summary.active).toBe(1);
    expect(result.summary.inactive).toBe(1);
    expect(result.rows[0].isActive).toBe(true);
    expect(result.rows[1].isActive).toBe(false);
  });

  it("identifies inactiveUserIds — user_ids with no active row", async () => {
    const now = new Date();
    // user 111 has only an inactive row → should appear in inactiveUserIds
    // user 222 has an active row → should NOT appear
    mockRows.push(
      {
        id: "1",
        tenant_id: "t-a",
        user_id: "111",
        app_id: "app1",
        contact_email: null,
        status: "inactive",
        deleted: null,
        created: now,
        error_message: null,
      },
      {
        id: "2",
        tenant_id: "t-b",
        user_id: "222",
        app_id: "app1",
        contact_email: null,
        status: "active",
        deleted: null,
        created: now,
        error_message: null,
      },
    );

    const caller = createCaller(adminCtx());
    const result = await caller.mpCredentialHealth();

    expect(result.inactiveUserIds).toContain("111");
    expect(result.inactiveUserIds).not.toContain("222");
  });

  it("does not expose access_token or refresh_token in rows", async () => {
    const now = new Date();
    mockRows.push({
      id: "1",
      tenant_id: "t-x",
      user_id: "999",
      app_id: "app1",
      contact_email: null,
      status: "active",
      deleted: null,
      created: now,
      error_message: null,
      // These would be present in the real DB row but should not appear in output
      access_token: "super-secret",
      refresh_token: "also-secret",
    });

    const caller = createCaller(adminCtx());
    const result = await caller.mpCredentialHealth();

    const row = result.rows[0];
    expect(row).not.toHaveProperty("access_token");
    expect(row).not.toHaveProperty("refresh_token");
  });

  it("throws UNAUTHORIZED for non-admin caller", async () => {
    const caller = createCaller(guestCtx());

    await expect(caller.mpCredentialHealth()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });
});

// ── mpCredentialUpsert ───────────────────────────────────────────────────────

describe("admin.mpCredentialUpsert", () => {
  afterEach(() => {
    vi.resetAllMocks();
    mockUpsertResult = null;
  });

  const validInput = {
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "204005478",
    appId: "2318642168506769",
    accessToken: "APP_USR-test-token",
    contactEmail: "mp@test.com",
    status: "active" as const,
  };

  it("returns the upserted row without token fields", async () => {
    const now = new Date();
    mockUpsertResult = {
      id: "row-id",
      tenant_id: "550e8400-e29b-41d4-a716-446655440000",
      user_id: validInput.userId,
      app_id: validInput.appId,
      contact_email: validInput.contactEmail,
      status: "active",
      created: now,
      updated: now,
    };

    const caller = createCaller(adminCtx());
    const result = await caller.mpCredentialUpsert(validInput);

    expect(result.tenantId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.userId).toBe(validInput.userId);
    expect(result.appId).toBe(validInput.appId);
    expect(result.status).toBe("active");
    expect(result).not.toHaveProperty("accessToken");
    expect(result).not.toHaveProperty("access_token");
  });

  it("accepts optional contactEmail being absent", async () => {
    const now = new Date();
    mockUpsertResult = {
      id: "row-2",
      tenant_id: "550e8400-e29b-41d4-a716-446655440000",
      user_id: validInput.userId,
      app_id: validInput.appId,
      contact_email: null,
      status: "active",
      created: now,
      updated: now,
    };

    const caller = createCaller(adminCtx());
    const { contactEmail: _omit, ...inputWithoutEmail } = validInput;
    const result = await caller.mpCredentialUpsert(inputWithoutEmail);

    expect(result.contactEmail).toBeNull();
  });

  it("throws UNAUTHORIZED for non-admin caller", async () => {
    const caller = createCaller(guestCtx());

    await expect(caller.mpCredentialUpsert(validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });
});
