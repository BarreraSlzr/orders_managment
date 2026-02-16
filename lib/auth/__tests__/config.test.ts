import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAuthConfig, resetAuthConfig } from "../config";

describe("lib/auth/config", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetAuthConfig();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAuthConfig();
  });

  it("throws when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;
    expect(() => getAuthConfig()).toThrow("AUTH_SECRET must be set");
  });

  it("throws when AUTH_SECRET is too short", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => getAuthConfig()).toThrow("at least 32 characters");
  });

  it("returns config with defaults when only AUTH_SECRET is set", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    const cfg = getAuthConfig();

    expect(cfg.secret).toBe("a".repeat(32));
    expect(cfg.cookieName).toBe("__session");
    expect(cfg.sessionTTL).toBe(604800);
    expect(cfg.allowedOrigins).toEqual([]);
    expect(cfg.cookieDomain).toBe("");
  });

  it("reads all env overrides", () => {
    process.env.AUTH_SECRET = "x".repeat(64);
    process.env.AUTH_COOKIE_NAME = "my_cookie";
    process.env.AUTH_SESSION_TTL = "3600";
    process.env.AUTH_ALLOWED_ORIGINS = "https://a.com, https://b.com";
    process.env.AUTH_COOKIE_DOMAIN = ".example.com";

    const cfg = getAuthConfig();

    expect(cfg.cookieName).toBe("my_cookie");
    expect(cfg.sessionTTL).toBe(3600);
    expect(cfg.allowedOrigins).toEqual(["https://a.com", "https://b.com"]);
    expect(cfg.cookieDomain).toBe(".example.com");
  });

  it("caches config on subsequent calls", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    const first = getAuthConfig();
    // Mutate env – should not matter because cached
    process.env.AUTH_SECRET = "b".repeat(32);
    const second = getAuthConfig();
    expect(second).toBe(first); // same reference
  });

  it("resetAuthConfig clears cache", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    const first = getAuthConfig();
    resetAuthConfig();
    process.env.AUTH_SECRET = "b".repeat(32);
    const second = getAuthConfig();
    expect(second.secret).toBe("b".repeat(32));
    expect(second).not.toBe(first);
  });
});
