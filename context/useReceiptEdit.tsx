"use client";

/**
 * ReceiptEditContext
 *
 * Owns the ephemeral UI session for editing a single order's items:
 *   editMode, selectedItemIds, totalPrice
 *
 * Sits one level below OrdersProvider (order-list / multi-order selection)
 * and above pure presentation leaves like ReceiptItems / ReceiptActions.
 *
 * State hierarchy:
 *   URL/nuqs  →  OrdersProvider  →  ReceiptEditProvider  →  leaf components
 */

import { useAdminDefaults } from "@/context/useAdminDefaults";
import { useOrders } from "@/context/useOrders";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useOrderItemsProducts } from "@/hooks/useOrderItemsProducts";
import { OrderItem, OrderItemsView } from "@/lib/sql/types";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReceiptEditState {
  order: Omit<OrderItemsView, "products">;
  items: OrderItem[];
  editMode: boolean;
  selectedItemIds: Set<string>;
  /** Subtotal of currently selected items (0 when nothing is checked) */
  totalPrice: number;
  /** True when at least one item checkbox is checked */
  hasSelection: boolean;
  selectionCount: number;
  /** When true the payment method picker overlay is shown */
  paymentPickerOpen: boolean;
  /** The admin-configured default payment option (e.g. 3 = credit card) */
  defaultPaymentOptionId: number;
}

export interface ReceiptEditActions {
  toggleEditMode: () => void;
  clearSelection: () => void;
  /** Toggle a single item in/out of the selection set */
  toggleItemSelection: (id: string) => void;
  /** Dispatches the correct mutation based on the submit button id */
  handleActionSubmit: (
    actionType:
      | "split"
      | "updatePayment"
      | "toggleTakeAway"
      | "remove"
      | "close"
      | "open",
    formData: FormData,
  ) => Promise<void>;
  /** Explicitly set a payment option on selected items (from picker) */
  handleSetPaymentOption: (paymentOptionId: number) => Promise<void>;
  /** Smart toggle: cash → preferred default, non-cash → cash */
  handleTogglePayment: () => Promise<void>;
  /** Open / close the payment method picker */
  setPaymentPickerOpen: (open: boolean) => void;
  /** Enter edit mode with all items of a product pre-selected */
  enterEditWithProduct: (productId: string) => void;
  /** Remove ONE item per unique product in selection (decrement qty) */
  handleDecrementSelected: () => Promise<void>;
  /** Add ONE item per unique product in selection (increment qty) */
  handleIncrementSelected: () => Promise<void>;
  /** Trigger Mercado Pago sync for a closed order */
  handleStartMercadoPagoSync: (params: {
    orderId: string;
    flow?: "qr" | "pdv";
  }) => Promise<import("@/lib/types").MpSyncResult>;
}

export type ReceiptEditContextValue = ReceiptEditState & ReceiptEditActions;

// ─── Context ─────────────────────────────────────────────────────────────────

const ReceiptEditContext = createContext<ReceiptEditContextValue>(
  (undefined as unknown) as ReceiptEditContextValue,
);

// ─── Provider ────────────────────────────────────────────────────────────────

interface ReceiptEditProviderProps {
  data: OrderItemsView;
  /** Start in edit mode (default false) */
  defaultEditMode?: boolean;
}

export function ReceiptEditProvider({
  data,
  defaultEditMode = false,
  children,
}: PropsWithChildren<ReceiptEditProviderProps>) {
  const { products: items, ...order } = data;

  const [editMode, setEditMode] = useState(defaultEditMode);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [totalPrice, setTotalPrice] = useState(0);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);

  const {
    handleSplitOrder,
    handleUpdateItemDetails,
    handleCloseOrder,
    handleOpenOrder,
    handleStartMercadoPagoSync,
    handleSetPaymentOption: handleSetPaymentOptionBase,
  } = useOrders();
  const { handleUpdateOrderItems } = useOrderItemsProducts();
  const { defaults } = useAdminDefaults();
  const { tenantName } = useAdminStatus();
  const isCafeBaguettesTenant =
    tenantName?.trim().toLowerCase() === "cafe&baguettes";
  const preferredPaymentFallbackId = isCafeBaguettesTenant ? 3 : 2;

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasSelection = selectedItemIds.size > 0;
  const selectionCount = selectedItemIds.size;

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
    setSelectedItemIds(new Set());
    setTotalPrice(0);
    setPaymentPickerOpen(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
    setTotalPrice(0);
    setPaymentPickerOpen(false);
  }, []);

  /** Enter edit mode and pre-select all items belonging to a product. */
  const enterEditWithProduct = useCallback(
    (productId: string) => {
      const product = items.find((p) => p.product_id === productId);
      if (!product) return;
      const ids = new Set(product.items.map((it) => `${it.id}`));
      const price = product.items.reduce(
        (sum, it) =>
          sum + product.price + it.extras.reduce((s, e) => s + e.price, 0),
        0,
      );
      setEditMode(true);
      setSelectedItemIds(ids);
      setTotalPrice(price);
      setPaymentPickerOpen(false);
    },
    [items],
  );

  const toggleItemSelection = useCallback(
    (id: string) => {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        // Recalculate subtotal against the new set
        const newTotal = items.reduce(
          (total, orderItem) =>
            total +
            orderItem.items.reduce((sub, it) => {
              if (!next.has(`${it.id}`)) return sub;
              const extrasPrice = it.extras.reduce((s, e) => s + e.price, 0);
              return sub + orderItem.price + extrasPrice;
            }, 0),
          0,
        );
        setTotalPrice(newTotal);
        return next;
      });
    },
    [items],
  );

  const handleActionSubmit = useCallback(
    async (
      actionType:
        | "split"
        | "updatePayment"
        | "toggleTakeAway"
        | "remove"
        | "close"
        | "open",
      formData: FormData,
    ) => {
      // Append selected item IDs from context — source of truth, not the DOM.
      // This makes the submit independent of whether checkboxes are checked in DOM.
      for (const id of Array.from(selectedItemIds)) {
        formData.append("item_id", id);
      }

      switch (actionType) {
        case "split":
          await handleSplitOrder(formData);
          break;
        case "updatePayment":
        case "toggleTakeAway":
        case "remove":
          await handleUpdateItemDetails(actionType, formData);
          break;
        case "close":
          await handleCloseOrder(formData);
          return;
        case "open":
          await handleOpenOrder(formData);
          return;
      }
      // Stay in edit mode — just clear the selection so the user can
      // immediately keep editing without having to re-enter edit mode.
      setSelectedItemIds(new Set());
      setTotalPrice(0);
      setPaymentPickerOpen(false);
    },
    [
      selectedItemIds,
      handleSplitOrder,
      handleUpdateItemDetails,
      handleCloseOrder,
      handleOpenOrder,
    ],
  );

  /** Explicitly set a payment option on selected items (from long-press picker). */
  const handleSetPaymentOption = useCallback(
    async (paymentOptionId: number) => {
      const itemIds = Array.from(selectedItemIds).map(Number);
      if (itemIds.length === 0) return;
      await handleSetPaymentOptionBase({
        orderId: order.id,
        itemIds,
        paymentOptionId,
      });
      // Close picker, clear selection, stay in edit mode
      setPaymentPickerOpen(false);
      setSelectedItemIds(new Set());
      setTotalPrice(0);
    },
    [selectedItemIds, order.id, handleSetPaymentOptionBase],
  );

  /** Smart toggle: cash ↔ preferred non-cash (admin default when configured,
   *  otherwise transfer by default, or credit for cafe&baguettes). */
  const handleTogglePayment = useCallback(async () => {
    const itemIds = Array.from(selectedItemIds).map(Number);
    if (itemIds.length === 0) return;

    // Check current payment state of selected items
    const selectedPaymentIds = items.flatMap((p) =>
      p.items
        .filter((it) => selectedItemIds.has(`${it.id}`))
        .map((it) => it.payment_option_id),
    );
    const preferredId =
      defaults?.defaultPaymentOptionId ?? preferredPaymentFallbackId;
    const allAreDefault = selectedPaymentIds.every((id) => id === preferredId);
    const targetPaymentId = allAreDefault
      ? 1 // all are the preferred default → switch to cash
      : preferredId; // otherwise → set to preferred default

    await handleSetPaymentOptionBase({
      orderId: order.id,
      itemIds,
      paymentOptionId: targetPaymentId,
    });
    setSelectedItemIds(new Set());
    setTotalPrice(0);
    setPaymentPickerOpen(false);
  }, [
    selectedItemIds,
    items,
    order.id,
    defaults,
    preferredPaymentFallbackId,
    handleSetPaymentOptionBase,
  ]);

  /** Derive unique productIds from the current selection. */
  const getSelectedProductIds = useCallback((): string[] => {
    const productIds = new Set<string>();
    for (const product of items) {
      for (const it of product.items) {
        if (selectedItemIds.has(`${it.id}`)) {
          productIds.add(product.product_id);
        }
      }
    }
    return Array.from(productIds);
  }, [items, selectedItemIds]);

  /** Remove ONE item per unique product in selection (decrement qty by 1 each). */
  const handleDecrementSelected = useCallback(async () => {
    const productIds = getSelectedProductIds();
    if (productIds.length === 0) return;
    // Pick just ONE item_id per product to remove (the first selected one)
    const idsToRemove: number[] = [];
    for (const pid of productIds) {
      const product = items.find((p) => p.product_id === pid);
      const match = product?.items.find((it) =>
        selectedItemIds.has(`${it.id}`),
      );
      if (match) idsToRemove.push(match.id);
    }
    if (idsToRemove.length === 0) return;
    const fd = new FormData();
    fd.append("orderId", order.id);
    for (const id of idsToRemove) fd.append("item_id", `${id}`);
    await handleUpdateItemDetails("remove", fd);
    setSelectedItemIds(new Set());
    setTotalPrice(0);
    setPaymentPickerOpen(false);
  }, [
    getSelectedProductIds,
    items,
    selectedItemIds,
    order.id,
    handleUpdateItemDetails,
  ]);

  /** Add ONE item per unique product in selection (increment qty by 1 each). */
  const handleIncrementSelected = useCallback(async () => {
    const productIds = getSelectedProductIds();
    if (productIds.length === 0) return;
    for (const pid of productIds) {
      await handleUpdateOrderItems(pid, "INSERT");
    }
    setSelectedItemIds(new Set());
    setTotalPrice(0);
    setPaymentPickerOpen(false);
  }, [getSelectedProductIds, handleUpdateOrderItems]);

  // ── Value ─────────────────────────────────────────────────────────────────
  const value = useMemo<ReceiptEditContextValue>(
    () => ({
      order,
      items,
      editMode,
      selectedItemIds,
      totalPrice,
      hasSelection,
      selectionCount,
      paymentPickerOpen,
      defaultPaymentOptionId:
        defaults?.defaultPaymentOptionId ?? preferredPaymentFallbackId,
      toggleEditMode,
      clearSelection,
      toggleItemSelection,
      enterEditWithProduct,
      handleActionSubmit,
      handleSetPaymentOption,
      handleTogglePayment,
      setPaymentPickerOpen,
      handleDecrementSelected,
      handleIncrementSelected,
      handleStartMercadoPagoSync,
    }),

    [
      editMode,
      selectedItemIds,
      totalPrice,
      hasSelection,
      selectionCount,
      paymentPickerOpen,
      defaults?.defaultPaymentOptionId,
      preferredPaymentFallbackId,
      toggleEditMode,
      clearSelection,
      toggleItemSelection,
      enterEditWithProduct,
      handleActionSubmit,
      handleSetPaymentOption,
      handleTogglePayment,
      setPaymentPickerOpen,
      handleDecrementSelected,
      handleIncrementSelected,
      handleStartMercadoPagoSync,
    ],
  );

  return (
    <ReceiptEditContext.Provider value={value}>
      {children}
    </ReceiptEditContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReceiptEdit(): ReceiptEditContextValue {
  const ctx = useContext(ReceiptEditContext);
  if (!ctx)
    throw new Error("useReceiptEdit must be used inside <ReceiptEditProvider>");
  return ctx;
}
