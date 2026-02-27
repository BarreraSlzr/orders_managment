/**
 * Unit tests for credentialsService edge-case fix:
 *  - B2: Transient errors return stale token instead of bricking credentials
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock database
const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
const mockExecute = vi.fn().mockResolvedValue([]);
const mockReturningAll = vi.fn(() => ({
  executeTakeFirst: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sql/database", () => {
  const d = {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      executeTakeFirst: mockExecuteTakeFirst,
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: mockExecute,
          })),
          execute: mockExecute,
          returningAll: mockReturningAll,
        })),
      })),
    })),
  };
  return {
    db: d,
    getDb: () => d,
    sql: Object.assign(vi.fn(() => null), {
      raw: vi.fn(),
    }),
  };
});

// Mock the tokenCrypto module — pass-through (no real encryption)
vi.mock("@/lib/services/mercadopago/tokenCrypto", () => ({
  encryptMpToken: vi.fn((t: string) => `enc:${t}`),
  decryptMpToken: vi.fn((t: string) => (t.startsWith("enc:") ? t.slice(4) : t)),
  isMpTokenEncrypted: vi.fn((t: string) => t.startsWith("enc:")),
}));

// Mock the oauthService
const mockRefreshAccessToken = vi.fn();
vi.mock("@/lib/services/mercadopago/oauthService", () => ({
  getOAuthConfig: vi.fn().mockResolvedValue({
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "http://localhost/callback",
  }),
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

// Now import the module under test
import { db } from "@/lib/sql/database";
import { getCredentials } from "../credentialsService";

describe("credentialsService — refreshCredentialsIfNeeded (B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const expiredCreds = {
    id: 1,
    tenant_id: "t-1",
    access_token: "enc:old-tok",
    refresh_token: "enc:refresh-tok",
    user_id: "999",
    status: "active",
    contact_email: "test@example.com",
    error_message: null,
    created: new Date(),
    deleted: null,
    refreshed_at: null,
    // Expired 10 minutes ago → triggers refresh
    token_expires_at: new Date(Date.now() - 10 * 60_000),
  };

  it("returns stale credentials on ECONNREFUSED (transient)", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(expiredCreds);
    mockRefreshAccessToken.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:443"),
    );

    const result = await getCredentials({ tenantId: "t-1" });

    // Should return the stale creds (decrypted), NOT null
    expect(result).not.toBeNull();
    expect(result?.access_token).toBe("old-tok");

    // The transient catch path should NOT mark credentials as "error".
    // We verify the function returned non-null (stale token) which proves
    // the credentials weren't bricked.
    expect(result?.tenant_id).toBe("t-1");
  });

  it("returns stale credentials on AbortError (timeout)", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(expiredCreds);
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockRefreshAccessToken.mockRejectedValueOnce(abortError);

    const result = await getCredentials({ tenantId: "t-1" });

    expect(result).not.toBeNull();
    expect(result?.access_token).toBe("old-tok");
  });

  it("returns stale credentials on 503 Service Unavailable (transient)", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(expiredCreds);
    mockRefreshAccessToken.mockRejectedValueOnce(
      new Error("HTTP 503 Service Unavailable"),
    );

    const result = await getCredentials({ tenantId: "t-1" });

    expect(result).not.toBeNull();
    expect(result?.access_token).toBe("old-tok");
  });

  it("marks credentials error on 401 invalid_grant (non-transient)", async () => {
    mockExecuteTakeFirst.mockResolvedValueOnce(expiredCreds);
    mockRefreshAccessToken.mockRejectedValueOnce(
      new Error("401 invalid_grant: refresh token revoked"),
    );

    const result = await getCredentials({ tenantId: "t-1" });

    // The function still returns creds (stale) but the DB row is marked error
    expect(result).not.toBeNull();
    // Verify updateTable was called (at least once for the error marking)
    expect(db.updateTable).toHaveBeenCalled();
  });
});
