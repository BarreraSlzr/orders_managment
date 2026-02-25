/**
 * Unit tests for oauthService edge-case fix:
 *  - D1: fetchWithTimeout (AbortController) wraps all OAuth fetch calls
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    exchangeCodeForToken,
    getUserInfo,
    refreshAccessToken
} from "../oauthService";

const TEST_CONFIG = {
  clientId: "test-id",
  clientSecret: "test-secret",
  redirectUri: "http://localhost:3000/callback",
};

describe("oauthService — fetchWithTimeout (D1)", () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  // ── Timeout behavior ───────────────────────────────────────────────────

  /**
   * Helper: creates a signal-aware mock fetch that hangs until aborted.
   */
  function mockHangingFetch() {
    globalThis.fetch = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            });
          }
          // never resolves otherwise
        }),
    );
  }

  it("exchangeCodeForToken aborts on timeout", async () => {
    mockHangingFetch();
    vi.useFakeTimers();

    const promise = exchangeCodeForToken({
      config: TEST_CONFIG,
      code: "auth-code-123",
    });

    vi.advanceTimersByTime(21_000); // past 20s timeout
    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });

  it("refreshAccessToken aborts on timeout", async () => {
    mockHangingFetch();
    vi.useFakeTimers();

    const promise = refreshAccessToken({
      config: TEST_CONFIG,
      refreshToken: "rt-abc",
    });

    vi.advanceTimersByTime(21_000);
    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });

  it("getUserInfo aborts on timeout", async () => {
    mockHangingFetch();
    vi.useFakeTimers();

    const promise = getUserInfo({ accessToken: "tok-xyz" });

    vi.advanceTimersByTime(21_000);
    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });

  // ── Success paths ──────────────────────────────────────────────────────

  it("exchangeCodeForToken succeeds within timeout", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: "at",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "rt",
        scope: "read",
        user_id: 12345,
        public_key: "pk",
      }),
    });

    const result = await exchangeCodeForToken({
      config: TEST_CONFIG,
      code: "code-1",
    });

    expect(result.access_token).toBe("at");
    expect(result.user_id).toBe(12345);
  });

  it("getUserInfo succeeds within timeout", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 999,
        nickname: "test-user",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
      }),
    });

    const result = await getUserInfo({ accessToken: "tok" });
    expect(result.id).toBe(999);
    expect(result.email).toBe("test@example.com");
  });

  // ── Error propagation ─────────────────────────────────────────────────

  it("exchangeCodeForToken throws on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue("invalid_grant"),
    });

    await expect(
      exchangeCodeForToken({ config: TEST_CONFIG, code: "bad" }),
    ).rejects.toThrow("Failed to exchange code: invalid_grant");
  });

  it("getUserInfo throws on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: vi.fn().mockResolvedValue("unauthorized"),
    });

    await expect(
      getUserInfo({ accessToken: "expired" }),
    ).rejects.toThrow("Failed to fetch user info: unauthorized");
  });
});
