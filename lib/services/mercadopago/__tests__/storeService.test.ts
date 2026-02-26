/**
 * Unit tests for storeService — MP Store/Branch CRUD.
 *
 * Covers:
 *  - createStore: sends correct body + path
 *  - listStores: paginated response
 *  - updateStore: PUT with partial body
 *  - deleteStore: DELETE path
 *  - Error propagation from mpFetch
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createStore,
    deleteStore,
    listStores,
    updateStore,
} from "../storeService";

describe("storeService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── createStore ─────────────────────────────────────────────────────────

  describe("createStore", () => {
    it("POST /users/{userId}/stores with name and external_id", async () => {
      const mockStore = {
        id: "store-1",
        name: "Mi Tienda",
        external_id: "ext-store-1",
        date_creation: "2024-01-01T00:00:00Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockStore),
      });

      const result = await createStore({
        accessToken: "tok",
        mpUserId: "user-123",
        name: "Mi Tienda",
        externalId: "ext-store-1",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/users/user-123/stores",
        expect.objectContaining({ method: "POST" }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.name).toBe("Mi Tienda");
      expect(sentBody.external_id).toBe("ext-store-1");
      expect(result.id).toBe("store-1");
    });

    it("includes location when provided", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "store-2", name: "Sucursal" }),
      });

      await createStore({
        accessToken: "tok",
        mpUserId: "user-123",
        name: "Sucursal",
        externalId: "ext-2",
        location: {
          streetName: "Av Reforma",
          streetNumber: "123",
          cityName: "CDMX",
          stateName: "CDMX",
        },
      });

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.location.street_name).toBe("Av Reforma");
      expect(sentBody.location.city_name).toBe("CDMX");
    });
  });

  // ── listStores ──────────────────────────────────────────────────────────

  describe("listStores", () => {
    it("GET /users/{userId}/stores returns results array", async () => {
      const mockResponse = {
        results: [{ id: "s-1", name: "Store 1" }],
        paging: { total: 1, offset: 0, limit: 50 },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await listStores({
        accessToken: "tok",
        mpUserId: "user-123",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/users/user-123/stores",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ── updateStore ─────────────────────────────────────────────────────────

  describe("updateStore", () => {
    it("PUT /users/{userId}/stores/{storeId} with partial body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "s-1", name: "Updated" }),
      });

      await updateStore({
        accessToken: "tok",
        mpUserId: "user-123",
        storeId: "s-1",
        name: "Updated",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/users/user-123/stores/s-1",
        expect.objectContaining({ method: "PUT" }),
      );

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(call[1]?.body as string);
      expect(sentBody.name).toBe("Updated");
    });
  });

  // ── deleteStore ─────────────────────────────────────────────────────────

  describe("deleteStore", () => {
    it("DELETE /users/{userId}/stores/{storeId}", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await deleteStore({
        accessToken: "tok",
        mpUserId: "user-123",
        storeId: "s-99",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/users/user-123/stores/s-99",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  // ── Error propagation ──────────────────────────────────────────────────

  it("throws when MP API returns non-ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: "Unauthorized" }),
    });

    await expect(
      createStore({
        accessToken: "bad-tok",
        mpUserId: "user-123",
        name: "Fail",
        externalId: "e",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});
