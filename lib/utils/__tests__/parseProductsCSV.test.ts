import { describe, expect, it } from "vitest";
import {
    parseProductsCSV,
    type ParsedCSVResult,
} from "../parseProductsCSV";

describe("lib/utils/parseProductsCSV", () => {
  // ── Happy paths ──────────────────────────────────────────────────

  it("parses a simple CSV with header + data rows", () => {
    const csv = `name,price,tags
Ensalada Panela,10500,"ensalada,panela"
Agua,2500,bebida`;

    const result = parseProductsCSV({ csv });

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.totalLines).toBe(2);
    expect(result.rows[0]).toEqual({
      name: "Ensalada Panela",
      price: 10500,
      tags: "ensalada,panela",
    });
    expect(result.rows[1]).toEqual({
      name: "Agua",
      price: 2500,
      tags: "bebida",
    });
  });

  it("supports optional id column for upsert", () => {
    const csv = `id,name,price,tags
abc-123,Ensalada,10500,ensalada`;

    const result = parseProductsCSV({ csv });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("abc-123");
  });

  it("handles BOM at the start of file", () => {
    const csv = `\uFEFFname,price,tags
Product A,5000,test`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Product A");
  });

  it("handles Windows CRLF line endings", () => {
    const csv = "name,price,tags\r\nProduct A,5000,test\r\nProduct B,6000,test2";

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(2);
  });

  it("converts decimal prices to cents", () => {
    const csv = `name,price,tags
Cafe,55.00,bebida`;

    const result = parseProductsCSV({ csv });
    expect(result.rows[0].price).toBe(5500);
  });

  it("handles integer prices as cents", () => {
    const csv = `name,price,tags
Cafe,5500,bebida`;

    const result = parseProductsCSV({ csv });
    expect(result.rows[0].price).toBe(5500);
  });

  it("strips surrounding whitespace from tags", () => {
    const csv = `name,price,tags
Taco,3500," taco , carne , asada "`;

    const result = parseProductsCSV({ csv });
    expect(result.rows[0].tags).toBe("taco,carne,asada");
  });

  it("handles empty tags field", () => {
    const csv = `name,price,tags
Product,1000,`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tags).toBe("");
  });

  it("handles quoted fields with escaped quotes", () => {
    const csv = `name,price,tags
"Product ""Special""",1000,special`;

    const result = parseProductsCSV({ csv });
    expect(result.rows[0].name).toBe('Product "Special"');
  });

  // ── Validation errors ────────────────────────────────────────────

  it("rejects CSV without header and data", () => {
    const result = parseProductsCSV({ csv: "" });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("header row");
  });

  it("rejects CSV with only a header", () => {
    const result = parseProductsCSV({ csv: "name,price,tags" });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("header row");
  });

  it("rejects CSV missing required name column", () => {
    const csv = `price,tags
5000,test`;

    const result = parseProductsCSV({ csv });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('"name"');
  });

  it("rejects CSV missing required price column", () => {
    const csv = `name,tags
Product,test`;

    const result = parseProductsCSV({ csv });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('"price"');
  });

  it("reports row-level error for empty name", () => {
    const csv = `name,price,tags
,5000,test
Valid Product,5000,test`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Valid Product");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[0].message).toContain("Name is required");
  });

  it("reports row-level error for non-numeric price", () => {
    const csv = `name,price,tags
Product,abc,test`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  // ── Duplicate detection ──────────────────────────────────────────

  it("detects duplicate product names (case-insensitive)", () => {
    const csv = `name,price,tags
Ensalada,5000,ensalada
ensalada,6000,ensalada2`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Duplicate");
  });

  // ── Mixed valid and invalid rows ─────────────────────────────────

  it("processes valid rows and collects errors for invalid ones", () => {
    const csv = `name,price,tags
Good Product,5000,test
,999,broken
Another Good,3000,tags
Bad Price,not_a_number,oops`;

    const result: ParsedCSVResult = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.totalLines).toBe(4);
  });

  it("handles column order independence", () => {
    const csv = `tags,price,name
bebida,2500,Agua`;

    const result = parseProductsCSV({ csv });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      name: "Agua",
      price: 2500,
      tags: "bebida",
    });
  });
});
