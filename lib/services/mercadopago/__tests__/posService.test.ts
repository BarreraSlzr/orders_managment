/**
 * Unit tests for posService — MP Point-of-Sale CRUD.
 *
 * Covers:
 *  - createPos: POST with body fields, default category
 *  - listPos: GET with optional store_id filter
 *  - updatePos: PUT partial body
 *  - deletePos: DELETE path
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPos, deletePos, listPos, updatePos } from "../posService";

describe("posService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── createPos ───────────────────────────────────────────────────────────

  describe("createPos", () => {
    it("POST /pos with name, external_id, and default category", async () => {
      const mockPos = {
        id: 1,
        name: "Caja 1",
        external_id: "orders_pdv",
        category: 621102,
        fixed_amount: false,
        date_created: "2024-01-01T00:00:00Z",
        date_last_updated: "2024-01-01T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockPos),
      });

      const result = await createPos({
        accessToken: "tok",
        name: "Caja 1",
        externalId: "orders_pdv",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/pos",
        expect.objectContaining({ method: "POST" }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.name).toBe("Caja 1");
      expect(sentBody.external_id).toBe("orders_pdv");
      expect(sentBody.category).toBe(621102);
      expect(sentBody.fixed_amount).toBe(false);
      expect(result.id).toBe(1);
    });

    it("includes store_id when provided", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 2,
          name: "Caja 2",
          external_id: "pos-2",
          store_id: "store-1",
        }),
      });

      await createPos({
        accessToken: "tok",
        name: "Caja 2",
        externalId: "pos-2",
        storeId: "store-1",
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.store_id).toBe("store-1");
    });
  });

  // ── listPos ─────────────────────────────────────────────────────────────

  describe("listPos", () => {
    it("GET /pos returns results array", async () => {
      const mockResponse = {
        results: [{ id: 1, name: "Caja 1", external_id: "pdv" }],
        paging: { total: 1, offset: 0, limit: 50 },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await listPos({ accessToken: "tok" });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/pos",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toHaveLength(1);
    });

    it("appends store_id and external_id query params when filtering", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [], paging: { total: 0 } }),
      });

      const result = await listPos({
        accessToken: "tok",
        storeId: "store-1",
        externalId: "pdv",
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain("store_id=store-1");
      expect(url).toContain("external_id=pdv");
      expect(result).toEqual([]);
    });
  });

  // ── updatePos ───────────────────────────────────────────────────────────

  describe("updatePos", () => {
    it("PUT /pos/{posId} with partial body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 1, name: "Updated" }),
      });

      await updatePos({
        accessToken: "tok",
        posId: 1,
        name: "Updated",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/pos/1",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  // ── deletePos ───────────────────────────────────────────────────────────

  describe("deletePos", () => {
    it("DELETE /pos/{posId}", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await deletePos({ accessToken: "tok", posId: 99 });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/pos/99",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  // ── Error propagation ──────────────────────────────────────────────────

  it("throws when MP API returns non-ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: "Invalid category" }),
    });

    await expect(
      createPos({
        accessToken: "tok",
        name: "Fail",
        externalId: "e",
      }),
    ).rejects.toThrow("Invalid category");
  });
});
