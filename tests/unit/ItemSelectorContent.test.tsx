// @vitest-environment jsdom
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
import "@testing-library/jest-dom/vitest";
import React, { type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

const MOCK_ITEMS = [
  { id: "item-1", name: "Tomate", quantity_type_key: "Peso" },
  { id: "item-2", name: "Harina", quantity_type_key: "Peso" },
];

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
  Drawer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

function renderSelector(
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
  options?: {
    initialSearch?: string;
    initialValues?: {
      itemId: string;
      itemName: string;
      quantity: number;
      unit: string;
      price: number;
    };
  },
) {
  return render(
    <ItemSelectorContent
      onConfirm={onConfirm}
      onCancel={onCancel}
      initialSearch={options?.initialSearch}
      initialValues={options?.initialValues}
    />,
    { wrapper: makeWrapper() },
  );
}

function openDetailsForTomate(onConfirm = vi.fn(), onCancel = vi.fn()) {
  renderSelector(onConfirm, onCancel, {
    initialValues: {
      itemId: "item-1",
      itemName: "Tomate",
      quantity: 1,
      unit: "g",
      price: 0,
    },
  });
}

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
    expect(
      within(document.body).queryByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
      ),
    ).not.toBeInTheDocument();
  });

  it("shows matching result rows after typing a search query", async () => {
    renderSelector(vi.fn(), vi.fn(), { initialSearch: "Tom" });

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    expect(
      within(document.body).queryByTestId(
        tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-2"),
      ),
    ).not.toBeInTheDocument();
  });

  it("shows the create button when the query has no exact match", async () => {
    renderSelector(vi.fn(), vi.fn(), { initialSearch: "Otro ingrediente" });

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
      ).toBeInTheDocument();
    });
  });

  it("hides the create button when the query exactly matches an existing item", async () => {
    renderSelector(vi.fn(), vi.fn(), { initialSearch: "Tomate" });

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(
          tid(TEST_IDS.AGREGAR_GASTO.RESULT_ROW, "item-1"),
        ),
      ).toBeInTheDocument();
    });

    expect(
      within(document.body).queryByTestId(TEST_IDS.AGREGAR_GASTO.CREATE_BTN),
    ).not.toBeInTheDocument();
  });
});

describe("ItemSelectorContent — details step", () => {
  beforeEach(() => {
    mockTrpc.inventory.items.list.queryOptions.mockImplementation(() => ({
      queryKey: ["inventory", "items", "list"] as const,
      queryFn: vi.fn().mockResolvedValue(MOCK_ITEMS),
    }));
  });

  it("shows quantity and price inputs after selecting a result", async () => {
    openDetailsForTomate();

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT),
      ).toBeInTheDocument();
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.PRICE_INPUT),
      ).toBeInTheDocument();
    });
  });

  it("confirm button is enabled when a unit is auto-selected from the item's quantity type", async () => {
    openDetailsForTomate();

    await waitFor(() => {
      const confirmBtn = within(document.body).getByTestId(
        TEST_IDS.AGREGAR_GASTO.CONFIRM_BTN,
      ) as HTMLButtonElement;
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it("accept quantity input changes", async () => {
    openDetailsForTomate();

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT),
      ).toBeInTheDocument();
    });

    const qtyInput = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.QUANTITY_INPUT,
    ) as HTMLInputElement;

    fireEvent.change(qtyInput, { target: { value: "3.5" } });
    expect(qtyInput.value).toBe("3.5");
  });

  it("accept price input changes", async () => {
    openDetailsForTomate();

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.PRICE_INPUT),
      ).toBeInTheDocument();
    });

    const priceInput = within(document.body).getByTestId(
      TEST_IDS.AGREGAR_GASTO.PRICE_INPUT,
    ) as HTMLInputElement;

    fireEvent.change(priceInput, { target: { value: "150" } });
    expect(priceInput.value).toBe("150");
  });
});

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
    openDetailsForTomate(vi.fn(), onCancel);

    await waitFor(() => {
      expect(
        within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(document.body).getByTestId(TEST_IDS.AGREGAR_GASTO.CANCEL_BTN),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
