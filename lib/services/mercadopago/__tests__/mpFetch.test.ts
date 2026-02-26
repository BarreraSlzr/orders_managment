/**
 * Unit tests for mpFetch — shared HTTP helper for all MP API calls.
 *
 * Covers:
 *  - Authorization header always present
 *  - B4: X-Integrator-Id / X-Platform-Id injected from env vars
 *  - Extra headers merge
 *  - Timeout / AbortController behaviour
 *  - Error normalization from non-ok responses
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mpFetch } from "../mpFetch";

describe("mpFetch", () => {
  const originalFetch = globalThis.fetch;
  let savedIntegratorId: string | undefined;
  let savedPlatformId: string | undefined;

  beforeEach(() => {
    savedIntegratorId = process.env.MP_INTEGRATOR_ID;
    savedPlatformId = process.env.MP_PLATFORM_ID;
    delete process.env.MP_INTEGRATOR_ID;
    delete process.env.MP_PLATFORM_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    // Restore env
    if (savedIntegratorId !== undefined) process.env.MP_INTEGRATOR_ID = savedIntegratorId;
    else delete process.env.MP_INTEGRATOR_ID;
    if (savedPlatformId !== undefined) process.env.MP_PLATFORM_ID = savedPlatformId;
    else delete process.env.MP_PLATFORM_ID;
  });

  // ── Authorization ────────────────────────────────────────────────────────

  it("sends Authorization: Bearer header", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    await mpFetch({ accessToken: "my-token", path: "/v1/test" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  // ── B4: Integrator / Platform ID ────────────────────────────────────────

  it("injects X-Integrator-Id when MP_INTEGRATOR_ID env is set", async () => {
    process.env.MP_INTEGRATOR_ID = "int-123";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await mpFetch({ accessToken: "tok", path: "/test" });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHeaders = call[1]?.headers as Record<string, string>;
    expect(sentHeaders["X-Integrator-Id"]).toBe("int-123");
  });

  it("injects X-Platform-Id when MP_PLATFORM_ID env is set", async () => {
    process.env.MP_PLATFORM_ID = "plat-456";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await mpFetch({ accessToken: "tok", path: "/test" });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHeaders = call[1]?.headers as Record<string, string>;
    expect(sentHeaders["X-Platform-Id"]).toBe("plat-456");
  });

  it("omits integrator/platform headers when env vars are empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await mpFetch({ accessToken: "tok", path: "/test" });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHeaders = call[1]?.headers as Record<string, string>;
    expect(sentHeaders["X-Integrator-Id"]).toBeUndefined();
    expect(sentHeaders["X-Platform-Id"]).toBeUndefined();
  });

  // ── Extra headers ───────────────────────────────────────────────────────

  it("merges extraHeaders on top of defaults", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await mpFetch({
      accessToken: "tok",
      path: "/test",
      extraHeaders: { "X-Idempotency-Key": "uuid-123" },
    });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHeaders = call[1]?.headers as Record<string, string>;
    expect(sentHeaders["X-Idempotency-Key"]).toBe("uuid-123");
  });

  // ── Body & method ──────────────────────────────────────────────────────

  it("stringifies body for POST requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "new" }),
    });

    await mpFetch({
      accessToken: "tok",
      method: "POST",
      path: "/resource",
      body: { name: "test" },
    });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    expect(JSON.parse(call[1]?.body as string)).toEqual({ name: "test" });
  });

  it("defaults to GET method", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    await mpFetch({ accessToken: "tok", path: "/list" });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]?.method).toBe("GET");
    expect(call[1]?.body).toBeUndefined();
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it("throws with MP message on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: "Invalid param" }),
    });

    await expect(
      mpFetch({ accessToken: "tok", path: "/bad" }),
    ).rejects.toThrow("Invalid param");
  });

  it("throws with fallback message when no message in body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    });

    await expect(
      mpFetch({ accessToken: "tok", path: "/server-error" }),
    ).rejects.toThrow("MP API error 500");
  });

  // ── Timeout ─────────────────────────────────────────────────────────────

  it("aborts when the API hangs past the timeout", async () => {
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
        }),
    );

    vi.useFakeTimers();
    const promise = mpFetch({ accessToken: "tok", path: "/slow" });
    vi.advanceTimersByTime(21_000);

    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});
