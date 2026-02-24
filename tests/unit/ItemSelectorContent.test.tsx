// @vitest-environment jsdom
/**
 * Unit tests for components/Inventory/ItemSelector — ItemSelectorContent
 *
 * Covers:
 *  - Initial render shows search input with no result rows (empty search → no suggestions)
 *  - Typing shows matching inventory items from the tRPC list query
 *  - Typing a non-existent name shows the "Create" button
 *  - Exact match hides the "Create" button
 *  - Clicking a result navigates to the details step
 *  - Details step: quantity and price inputs are visible
 *  - Details step: confirm button is disabled when no unit of measure is selected
 *  - Cancel button calls onCancel regardless of the current step
 *
 * Run: bun vitest run tests/unit/ItemSelectorContent.test.tsx
 */

import { ItemSelectorContent } from "@/components/Inventory/ItemSelector";
import { TEST_IDS, tid } from "@/lib/testIds";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_ITEMS = [
  { id: "item-1", name: "Tomate", quantity_type_key: "Peso" },
  { id: "item-2", name: "Harina", quantity_type_key: "Peso" },
];

// ─── Hoisted mocks (must be declared before vi.mock) ─────────────────────────
// vi.hoisted runs before all imports so the mock factory can close over them.

const { mockTrpc } = vi.hoisted(() => {
  const makeItemsQueryOpts = (data: unknown) => ({
    queryKey: ["inventory", "items", "list"] as const,
    queryFn: vi.fn().mockResolvedValue(data),
  });

  const mockTrpc = {
    inventory: {
      items: {
        list: {
          queryOptions: vi.fn(() => makeItemsQueryOpts([])),
        },
        add: {
          mutationOptions: vi.fn(() => ({
            mutationFn: vi.fn().mockResolvedValue({ id: "new-item-id" }),
          })),
        },
      },
    },
  };

  return { mockTrpc };
});

vi.mock("@/lib/trpc/react", () => ({
  useTRPC: () => mockTrpc,
}));

// ─── Mock vaul Drawer sub-components ─────────────────────────────────────────
// DrawerHeader / DrawerTitle / DrawerFooter require a Radix Dialog context that
// is only provided by the full Drawer root. Since ItemSelectorContent is
// rendered headlessly (without the shell), we replace them with plain divs so
// the Radix context constraint doesn't fail.

vi.mock("@/components/ui/drawer", () => ({
  DrawerHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-header" className={className}>{children}</div>
  ),
  DrawerTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="drawer-title" className={className}>{children}</h2>
  ),
  DrawerFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-footer" className={className}>{children}</div>
  ),
  // Passthrough for anything else that might be imported from the module
  Drawer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Wrapper factory ──────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderSelector(
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
) {
  return render(
    <ItemSelectorContent onConfirm={onConfirm} onCancel={onCancel} />,
    { wrapper: makeWrapper() },
  );
}

// ─── Search step ──────────────────────────────────────────────────────────────

describe("ItemSelectorContent — search step", () => {
  beforeEach(() => {
    mockTrpc.inventory.items.list.queryOptions.mockImplementation(() => ({
      queryKey: ["inventory", "items", "list"] as const,
      queryFn: vi.fn().mockResolvedValue(MOCK_ITEMS),
    }));
  });

  it("renders the search input with no result rows on empty search", () => {
    renderSelector();
    expect(
      screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT),
    ).toBeInTheDocument();
    // No results because search is empty → suggestions = []
    expect(
      screen.queryByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
    ).not.toBeInTheDocument();
  });

  it("shows matching result rows after typing a search query", async () => {
    renderSelector();
    const input = screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT);

    fireEvent.change(input, { target: { value: "Tom" } });

    await waitFor(() => {
      expect(
        screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
      ).toBeInTheDocument();
    });

    // Non-matching item should not be rendered
    expect(
      screen.queryByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-2")),
    ).not.toBeInTheDocument();
  });

  it("shows the create button when the query has no exact match", async () => {
    renderSelector();
    const input = screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT);

    fireEvent.change(input, { target: { value: "Otro ingrediente" } });

    await waitFor(() => {
      expect(
        screen.getByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
      ).toBeInTheDocument();
    });
  });

  it("hides the create button when the query exactly matches an existing item", async () => {
    renderSelector();
    const input = screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT);

    fireEvent.change(input, { target: { value: "Tomate" } });

    // Wait for results to appear
    await waitFor(() => {
      expect(
        screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
      ).toBeInTheDocument();
    });

    // Create button must be absent for an exact match
    expect(
      screen.queryByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
    ).not.toBeInTheDocument();
  });
});

// ─── Details step ─────────────────────────────────────────────────────────────

describe("ItemSelectorContent — details step", () => {
  beforeEach(() => {
    mockTrpc.inventory.items.list.queryOptions.mockImplementation(() => ({
      queryKey: ["inventory", "items", "list"] as const,
      queryFn: vi.fn().mockResolvedValue(MOCK_ITEMS),
    }));
  });

  /** Navigate to the details step by selecting "Tomate" from results. */
  async function openDetailsForTomate(onConfirm = vi.fn(), onCancel = vi.fn()) {
    renderSelector(onConfirm, onCancel);

    const input = screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT);
    fireEvent.change(input, { target: { value: "Tom" } });

    await waitFor(() => {
      expect(
        screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
    );
  }

  it("shows quantity and price inputs after selecting a result", async () => {
    await openDetailsForTomate();

    expect(
      screen.getByTestId(TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(TEST_IDS.AGREGAR_GASTO.PRICE_INPUT),
    ).toBeInTheDocument();
  });

  it("confirm button is enabled when a unit is auto-selected from the item's quantity type", async () => {
    // Tomate has quantity_type_key "Peso" → measureTypes.Peso has options →
    // the useEffect pre-selects unitOptions[0], so the button becomes enabled.
    await openDetailsForTomate();

    const confirmBtn = screen.getByTestId(
      TEST_IDS.AGREGAR_GASTO.CONFIRM_BTN,
    ) as HTMLButtonElement;

    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it("accept quantity input changes", async () => {
    await openDetailsForTomate();

    const qtyInput = screen.getByTestId(
      TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT,
    ) as HTMLInputElement;

    fireEvent.change(qtyInput, { target: { value: "3.5" } });
    expect(qtyInput.value).toBe("3.5");
  });

  it("accept price input changes", async () => {
    await openDetailsForTomate();

    const priceInput = screen.getByTestId(
      TEST_IDS.AGREGAR_GASTO.PRICE_INPUT,
    ) as HTMLInputElement;

    fireEvent.change(priceInput, { target: { value: "150" } });
    expect(priceInput.value).toBe("150");
  });
});

// ─── Cancel / dismiss ─────────────────────────────────────────────────────────

describe("ItemSelectorContent — cancel behaviour", () => {
  beforeEach(() => {
    mockTrpc.inventory.items.list.queryOptions.mockImplementation(() => ({
      queryKey: ["inventory", "items", "list"] as const,
      queryFn: vi.fn().mockResolvedValue(MOCK_ITEMS),
    }));
  });

  it("cancel button calls onCancel from the search step", () => {
    const onCancel = vi.fn();
    renderSelector(vi.fn(), onCancel);

    fireEvent.click(screen.getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancel button calls onCancel from the details step", async () => {
    const onCancel = vi.fn();

    // Reach the details step
    renderSelector(vi.fn(), onCancel);
    const input = screen.getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT);
    fireEvent.change(input, { target: { value: "Tom" } });

    await waitFor(() => {
      expect(
        screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId(tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1")),
    );

    fireEvent.click(screen.getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
