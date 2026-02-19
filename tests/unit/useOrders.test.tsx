// @vitest-environment jsdom
/**
 * Unit tests for hooks/useOrders — nuqs URL state integration
 *
 * Covers:
 *   - Initial state (empty orderId, no currentOrder)
 *   - setCurrentOrderDetails sets / clears orderId in URL
 *   - getDetails query is enabled only when orderId is non-empty
 *   - handleCloseOrder clears orderId and currentOrder
 *   - URL param ?orderId=xxx is picked up on mount (deep-link support)
 *   - Stale-data regression: removeProducts triggers cache invalidation
 *
 * Run: bun vitest run tests/unit/useOrders.test.tsx
 */
import { useOrders } from "@/hooks/useOrders";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Stable mock objects (hoisted so vi.mock can reference them) ──────────────
// vi.hoisted runs before imports so the mock factory below can close over these.

const { mockTrpc } = vi.hoisted(() => {
  const makeQueryOpts = (key: unknown[], opts?: { enabled?: boolean }) => ({
    queryKey: key,
    queryFn: vi.fn().mockResolvedValue(null),
    enabled: opts?.enabled ?? true,
  });
  const makeMutOpts = () => ({
    mutationFn: vi.fn().mockResolvedValue({}),
  });

  const mockTrpc = {
    orders: {
      list: {
        queryOptions: vi.fn((_args: unknown) => makeQueryOpts(["orders", "list"])),
      },
      getDetails: {
        queryOptions: vi.fn(
          (args: { id: string }, opts?: { enabled?: boolean }) =>
            makeQueryOpts(["orders", "getDetails", args.id], opts),
        ),
      },
      split: { mutationOptions: vi.fn(makeMutOpts) },
      close: { mutationOptions: vi.fn(makeMutOpts) },
      open: { mutationOptions: vi.fn(makeMutOpts) },
      combine: { mutationOptions: vi.fn(makeMutOpts) },
      removeProducts: { mutationOptions: vi.fn(makeMutOpts) },
      togglePayment: { mutationOptions: vi.fn(makeMutOpts) },
      setPaymentOption: { mutationOptions: vi.fn(makeMutOpts) },
      toggleTakeaway: { mutationOptions: vi.fn(makeMutOpts) },
    },
  };

  return { mockTrpc };
});

// ─── Mock tRPC — always returns the same stable mockTrpc instance ─────────────
vi.mock("@/lib/trpc/react", () => ({
  useTRPC: () => mockTrpc,
}));

// ─── Wrapper factory ──────────────────────────────────────────────────────────

function makeWrapper(searchString = "") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter searchParams={new URLSearchParams(searchString)}>
          {children}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useOrders — nuqs URL state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialises with empty orderId and no currentOrder", () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper(),
    });

    expect(result.current.currentOrder).toBeNull();
    // getDetails must have been called with enabled:false (no orderId)
    expect(mockTrpc.orders.getDetails.queryOptions).toHaveBeenCalledWith(
      { id: "" },
      { enabled: false },
    );
  });

  it("setCurrentOrderDetails(order) enables the details query for that id", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper(),
    });

    const fakeOrder = { id: "order-abc", status: "opened" } as never;

    await act(async () => {
      await result.current.setCurrentOrderDetails(fakeOrder);
    });

    await waitFor(() => {
      expect(mockTrpc.orders.getDetails.queryOptions).toHaveBeenCalledWith(
        { id: "order-abc" },
        expect.objectContaining({ enabled: true }),
      );
    });
  });

  it("setCurrentOrderDetails(null) clears currentOrder", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper("orderId=order-abc"),
    });

    await act(async () => {
      await result.current.setCurrentOrderDetails(null);
    });

    await waitFor(() => {
      expect(result.current.currentOrder).toBeNull();
    });
  });

  it("deep-link: ?orderId=<id> in URL enables the details query on mount", () => {
    renderHook(() => useOrders({}), {
      wrapper: makeWrapper("orderId=order-xyz"),
    });

    expect(mockTrpc.orders.getDetails.queryOptions).toHaveBeenCalledWith(
      { id: "order-xyz" },
      expect.objectContaining({ enabled: true }),
    );
  });

  it("handleCloseOrder clears currentOrder after successful mutation", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper("orderId=order-to-close"),
    });

    const formData = new FormData();
    formData.append("orderId", "order-to-close");

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleCloseOrder(formData);
    });

    expect(success).toBe(true);

    await waitFor(() => {
      expect(result.current.currentOrder).toBeNull();
    });
  });
});

// ─── Stale-data regression contract ──────────────────────────────────────────
//
// CONTRACT: after a successful handleUpdateItemDetails("remove", ...)
// the cache must be invalidated so React Query re-fetches automatically —
// currentOrder updates without a manual page reload.
//
describe("useOrders — stale-data regression contract", () => {
  it("handleUpdateItemDetails('remove') calls invalidateQueries for detail + list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          <NuqsTestingAdapter
            searchParams={new URLSearchParams("orderId=order-1")}
          >
            {children}
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useOrders({}), { wrapper: Wrapper });

    const formData = new FormData();
    formData.append("orderId", "order-1");
    formData.append("item_id", "42");

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleUpdateItemDetails(
        "remove",
        formData,
      );
    });

    expect(success).toBe(true);
    // invalidateQueries must be called so cache refreshes without a reload
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

// ─── selectSingleOrder ────────────────────────────────────────────────────────
describe("selectSingleOrder", () => {
  it("sets selectedOrderIds to [orderId] when nothing is selected", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.selectSingleOrder("order-a"));

    await waitFor(() =>
      expect(result.current.selectedOrderIds).toEqual(["order-a"]),
    );
  });

  it("replaces a previous selection with the new orderId", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper("selected=order-x"),
    });

    act(() => result.current.selectSingleOrder("order-b"));

    await waitFor(() =>
      expect(result.current.selectedOrderIds).toEqual(["order-b"]),
    );
  });

  it("clears selection when tapping the already-selected order", async () => {
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper("selected=order-a"),
    });

    act(() => result.current.selectSingleOrder("order-a"));

    await waitFor(() =>
      expect(result.current.selectedOrderIds).toEqual([]),
    );
  });

  it("does NOT clear multi-select when tapping one of several selected orders", async () => {
    // Long-press built that multi-select; a tap should still replace with single
    const { result } = renderHook(() => useOrders({}), {
      wrapper: makeWrapper("selected=order-a,order-b"),
    });

    act(() => result.current.selectSingleOrder("order-b"));

    await waitFor(() =>
      expect(result.current.selectedOrderIds).toEqual(["order-b"]),
    );
  });
});
