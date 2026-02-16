/**
 * CSV parser for bulk product import.
 *
 * Expected CSV format (header row required):
 *   name,price,tags
 *   "Ensalada Panela",10500,"ensalada,panela"
 *
 * - `name`  — required, non-empty string
 * - `price` — required, integer (in cents) or decimal (in currency units, auto-converted)
 * - `tags`  — optional, comma-separated inside quotes
 * - `id`    — optional, uuid for upsert (update existing product)
 *
 * Returns validated rows + any row-level errors so the UI can show a preview.
 */
import { z } from "zod";

const ProductRowSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Name is required"),
  price: z.number().int("Price must be an integer (cents)"),
  tags: z.string().trim().default(""),
});

export type ProductRow = z.infer<typeof ProductRowSchema>;

export interface ParsedCSVResult {
  /** Successfully validated rows ready for upsert */
  rows: ProductRow[];
  /** Row-level errors: { line (1-based), raw text, message } */
  errors: Array<{ line: number; raw: string; message: string }>;
  /** Total lines parsed (excluding header) */
  totalLines: number;
}

/**
 * Parse a CSV string into validated product rows.
 *
 * Handles:
 * - Quoted fields (including commas inside quotes)
 * - Windows (\r\n) and Unix (\n) line endings
 * - Optional BOM at start of file
 * - Duplicate detection by name (case-insensitive)
 */
export function parseProductsCSV(params: { csv: string }): ParsedCSVResult {
  const { csv } = params;
  const result: ParsedCSVResult = { rows: [], errors: [], totalLines: 0 };

  // Strip BOM
  const clean = csv.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    result.errors.push({
      line: 1,
      raw: lines[0] ?? "",
      message: "CSV must have a header row and at least one data row",
    });
    return result;
  }

  // Parse header
  const headerFields = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().trim()
  );
  const nameIdx = headerFields.indexOf("name");
  const priceIdx = headerFields.indexOf("price");
  const tagsIdx = headerFields.indexOf("tags");
  const idIdx = headerFields.indexOf("id");

  if (nameIdx === -1 || priceIdx === -1) {
    result.errors.push({
      line: 1,
      raw: lines[0],
      message: 'CSV header must include "name" and "price" columns',
    });
    return result;
  }

  const seenNames = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    result.totalLines++;
    const fields = parseCSVLine(lines[i]);
    const lineNum = i + 1; // 1-based

    const raw: Record<string, unknown> = {
      name: fields[nameIdx] ?? "",
      price: parsePrice(fields[priceIdx] ?? ""),
      tags: (fields[tagsIdx] ?? "").replace(/\s*,\s*/g, ","),
    };
    if (idIdx !== -1 && fields[idIdx]) {
      raw.id = fields[idIdx];
    }

    const parsed = ProductRowSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((iss) => iss.message).join("; ");
      result.errors.push({ line: lineNum, raw: lines[i], message: msg });
      continue;
    }

    // Duplicate name check (case-insensitive)
    const normalizedName = parsed.data.name.toLowerCase();
    if (seenNames.has(normalizedName)) {
      result.errors.push({
        line: lineNum,
        raw: lines[i],
        message: `Duplicate product name: "${parsed.data.name}"`,
      });
      continue;
    }
    seenNames.add(normalizedName);

    result.rows.push(parsed.data);
  }

  return result;
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current); // last field
  return fields;
}

/**
 * Parse a price string. Handles:
 * - Integer cents: "5500" → 5500
 * - Decimal currency: "55.00" → 5500 (auto-converts to cents)
 */
function parsePrice(value: string): number {
  const trimmed = value.trim().replace(/[$,]/g, "");
  if (!trimmed) return NaN;

  const num = Number(trimmed);
  if (isNaN(num)) return NaN;

  // If it looks like decimal currency (has a dot and value < 1000),
  // convert to cents. Otherwise treat as already in cents.
  if (trimmed.includes(".")) {
    return Math.round(num * 100);
  }
  return num;
}
