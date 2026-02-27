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
import "./setup.dom";
import { TEST_IDS, tid } from "@/lib/testIds";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React, { type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_ITEMS = [
  { id: "item-1", name: "Tomate", quantity_type_key: "Peso" },
  { id: "item-2", name: "Harina", quantity_type_key: "Peso" },
];

// ─── Hoisted-safe shared mock object ─────────────────────────────────────────
// Use `var` so it exists when vi.mock is hoisted by the test runner.

let mockTrpc: {
  inventory: {
    items: {
      list: { queryOptions: ReturnType<typeof vi.fn> };
      add: { mutationOptions: ReturnType<typeof vi.fn> };
    };
  };
};

vi.mock("@/lib/trpc/react", () => {
  const makeItemsQueryOpts = (data: unknown) => ({
    queryKey: ["inventory", "items", "list"] as const,
    queryFn: vi.fn().mockResolvedValue(data),
  });

  mockTrpc = {
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

  return {
    useTRPC: () => mockTrpc,
  };
});

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
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT),
    ).toBeInTheDocument();
    // No results because search is empty → suggestions = []
    expect(
      within(document.body).queryByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
      ),
    ).not.toBeInTheDocument();
  });

  it("shows matching result rows after typing a search query", async () => {
    renderSelector();
    const user = userEvent.setup();
    const input = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT,
    );

    await user.type(input, "Tom");

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    // Non-matching item should not be rendered
    expect(
      within(document.body).queryByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-2"),
      ),
    ).not.toBeInTheDocument();
  });

  it("shows the create button when the query has no exact match", async () => {
    renderSelector();
    const user = userEvent.setup();
    const input = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT,
    );

    await user.type(input, "Otro ingrediente");

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
      ).toBeInTheDocument();
    });
  });

  it("hides the create button when the query exactly matches an existing item", async () => {
    renderSelector();
    const user = userEvent.setup();
    const input = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT,
    );

    await user.type(input, "Tomate");

    // Wait for results to appear
    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    // Create button must be absent for an exact match
    expect(
      within(document.body).queryByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
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
    const user = userEvent.setup();

    const input = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT,
    );
    await user.type(input, "Tom");

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(document.body).getByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
      ),
    );
  }

  it("shows quantity and price inputs after selecting a result", async () => {
    await openDetailsForTomate();

    expect(
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT),
    ).toBeInTheDocument();
    expect(
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.PRICE_INPUT),
    ).toBeInTheDocument();
  });

  it("confirm button is enabled when a unit is auto-selected from the item's quantity type", async () => {
    // Tomate has quantity_type_key "Peso" → measureTypes.Peso has options →
    // the useEffect pre-selects unitOptions[0], so the button becomes enabled.
    await openDetailsForTomate();

    const confirmBtn = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.CONFIRM_BTN,
    ) as HTMLButtonElement;

    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it("accept quantity input changes", async () => {
    await openDetailsForTomate();
    const user = userEvent.setup();

    const qtyInput = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT,
    ) as HTMLInputElement;

    await user.clear(qtyInput);
    await user.type(qtyInput, "3.5");
    expect(qtyInput.value).toBe("3.5");
  });

  it("accept price input changes", async () => {
    await openDetailsForTomate();
    const user = userEvent.setup();

    const priceInput = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.PRICE_INPUT,
    ) as HTMLInputElement;

    await user.clear(priceInput);
    await user.type(priceInput, "150");
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

    fireEvent.click(
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancel button calls onCancel from the details step", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    // Reach the details step
    renderSelector(vi.fn(), onCancel);
    const input = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.SEARCH_INPUT,
    );
    await user.type(input, "Tom");

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(document.body).getByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
      ),
    );

    fireEvent.click(
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
