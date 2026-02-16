import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthConfig } from "../config";
import { createSessionToken, verifySessionToken } from "../session";

const TEST_SECRET = "test-secret-that-is-at-least-32-chars-long!!";

describe("lib/auth/session", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetAuthConfig();
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAuthConfig();
  });

  it("creates a token with two base64url segments separated by a dot", async () => {
    const token = await createSessionToken("user-1");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    // base64url: only [A-Za-z0-9_-]
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("round-trips: verify returns the original payload", async () => {
    const token = await createSessionToken("user-42", { role: "admin" });
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-42");
    expect(payload!.role).toBe("admin");
    expect(typeof payload!.iat).toBe("number");
    expect(typeof payload!.exp).toBe("number");
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken("user-1");
    // flip one character in the payload segment
    const parts = token.split(".");
    const tampered = parts[0].slice(0, -1) + (parts[0].endsWith("A") ? "B" : "A");
    const result = await verifySessionToken(`${tampered}.${parts[1]}`);
    expect(result).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken("user-1");
    const parts = token.split(".");
    const tampered = parts[1].slice(0, -1) + (parts[1].endsWith("A") ? "B" : "A");
    const result = await verifySessionToken(`${parts[0]}.${tampered}`);
    expect(result).toBeNull();
  });

  it("rejects a token with wrong number of segments", async () => {
    expect(await verifySessionToken("only-one-segment")).toBeNull();
    expect(await verifySessionToken("a.b.c")).toBeNull();
  });

  it("rejects an expired token", async () => {
    // Override TTL to 0 seconds so the token is immediately expired
    process.env.AUTH_SESSION_TTL = "0";
    resetAuthConfig();

    const token = await createSessionToken("user-expired");
    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("user-1");

    // Change the secret
    process.env.AUTH_SECRET = "different-secret-that-is-at-least-32-chars!!";
    resetAuthConfig();

    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });
});
