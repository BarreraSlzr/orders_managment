import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminConfig, isValidIdentity, resetAdminConfig } from "../admin";

const ORIGINAL_ENV = { ...process.env };

function setBaseEnv() {
  process.env.ADMIN_PASSWORD = "super-secret";
  process.env.ADMIN_SHARED_API_KEY = "shared-key";
}

describe("lib/auth/admin", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAdminConfig();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetAdminConfig();
  });

  it("throws when required env vars are missing", () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SHARED_API_KEY;
    expect(() => getAdminConfig()).toThrow("ADMIN_PASSWORD");
  });

  it("returns parsed config when env vars are set", () => {
    setBaseEnv();
    const config = getAdminConfig();

    expect(config.password).toBe("super-secret");
    expect(config.apiKey).toBe("shared-key");
    expect(config.cookieName).toBe("__admin_api_key");
  });

  it("validates identity when role, key, and username are present", () => {
    expect(
      isValidIdentity({
        candidate: {
          role: "owner",
          key: "alpha",
          username: "emma",
          email: "",
        },
      })
    ).toBe(true);
  });

  it("validates identity when role, key, and email are present", () => {
    expect(
      isValidIdentity({
        candidate: {
          role: "admin",
          key: "beta",
          username: "",
          email: "emma@example.com",
        },
      })
    ).toBe(true);
  });

  it("rejects identity when role is missing", () => {
    expect(
      isValidIdentity({
        candidate: {
          role: "",
          key: "alpha",
          username: "emma",
          email: "emma@example.com",
        },
      })
    ).toBe(false);
  });

  it("rejects identity when key is missing", () => {
    expect(
      isValidIdentity({
        candidate: {
          role: "owner",
          key: "",
          username: "emma",
          email: "emma@example.com",
        },
      })
    ).toBe(false);
  });

  it("rejects identity when username and email are missing", () => {
    expect(
      isValidIdentity({
        candidate: {
          role: "owner",
          key: "alpha",
          username: "",
          email: "",
        },
      })
    ).toBe(false);
  });
});
