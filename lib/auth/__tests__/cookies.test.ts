import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthConfig } from "../config";
import { clearSessionCookie, setSessionCookie } from "../cookies";

const TEST_SECRET = "test-secret-that-is-at-least-32-chars-long!!";

/**
 * Helper: extract a cookie from a NextResponse by name.
 */
function getCookie(response: NextResponse, name: string) {
  return response.cookies.get(name);
}

describe("lib/auth/cookies", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetAuthConfig();
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.AUTH_COOKIE_NAME = "__session";
    delete process.env.AUTH_COOKIE_DOMAIN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAuthConfig();
  });

  describe("setSessionCookie", () => {
    it("sets a cookie with the configured name", async () => {
      const res = NextResponse.json({ ok: true });
      await setSessionCookie(res, "user-1");

      const cookie = getCookie(res, "__session");
      expect(cookie).toBeDefined();
      expect(cookie!.value).toBeTruthy();
      // Should be a valid token (two base64url segments)
      expect(cookie!.value.split(".")).toHaveLength(2);
    });

    it("uses a custom cookie name from config", async () => {
      process.env.AUTH_COOKIE_NAME = "custom_sess";
      resetAuthConfig();

      const res = NextResponse.json({ ok: true });
      await setSessionCookie(res, "user-1");

      const cookie = getCookie(res, "custom_sess");
      expect(cookie).toBeDefined();
    });

    it("sets httpOnly and path=/", async () => {
      const res = NextResponse.json({ ok: true });
      await setSessionCookie(res, "user-1");

      const cookie = getCookie(res, "__session");
      expect(cookie!.path).toBe("/");
      expect(cookie!.httpOnly).toBe(true);
    });

    it("sets domain when AUTH_COOKIE_DOMAIN is configured", async () => {
      process.env.AUTH_COOKIE_DOMAIN = ".example.com";
      resetAuthConfig();

      const res = NextResponse.json({ ok: true });
      await setSessionCookie(res, "user-1");

      const cookie = getCookie(res, "__session");
      expect(cookie!.domain).toBe(".example.com");
    });
  });

  describe("clearSessionCookie", () => {
    it("sets cookie with empty value and maxAge 0", () => {
      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res);

      const cookie = getCookie(res, "__session");
      expect(cookie).toBeDefined();
      expect(cookie!.value).toBe("");
      expect(cookie!.maxAge).toBe(0);
    });

    it("sets domain when AUTH_COOKIE_DOMAIN is configured", () => {
      process.env.AUTH_COOKIE_DOMAIN = ".example.com";
      resetAuthConfig();

      const res = NextResponse.json({ ok: true });
      clearSessionCookie(res);

      const cookie = getCookie(res, "__session");
      expect(cookie!.domain).toBe(".example.com");
    });
  });
});
