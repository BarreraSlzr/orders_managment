import { validateSnapshot } from "@/lib/sql/backup";
import { describe, expect, it } from "vitest";

describe("validateSnapshot", () => {
  it("rejects null input", () => {
    const result = validateSnapshot({ data: null });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Snapshot must be an object");
  });

  it("rejects non-object input", () => {
    const result = validateSnapshot({ data: "hello" });
    expect(result.valid).toBe(false);
  });

  it("rejects missing version field", () => {
    const result = validateSnapshot({
      data: { exportedAt: "2026-01-01", tables: {} },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing or invalid 'version' field");
  });

  it("rejects missing exportedAt field", () => {
    const result = validateSnapshot({
      data: { version: 1, tables: {} },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing or invalid 'exportedAt' field");
  });

  it("rejects missing tables field", () => {
    const result = validateSnapshot({
      data: { version: 1, exportedAt: "2026-01-01" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing or invalid 'tables' field");
  });

  it("rejects non-array table entries", () => {
    const result = validateSnapshot({
      data: {
        version: 1,
        exportedAt: "2026-01-01",
        tables: { products: "not-an-array" },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tables.products must be an array");
  });

  it("accepts a valid snapshot structure", () => {
    const result = validateSnapshot({
      data: {
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        tables: {
          products: [{ id: "1", name: "Taco", price: 2500, tags: "food" }],
          orders: [],
        },
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts empty tables object", () => {
    const result = validateSnapshot({
      data: {
        version: 1,
        exportedAt: "2026-02-16",
        tables: {},
      },
    });
    expect(result.valid).toBe(true);
  });

  it("accumulates multiple errors", () => {
    const result = validateSnapshot({
      data: {
        tables: { products: "bad" },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
