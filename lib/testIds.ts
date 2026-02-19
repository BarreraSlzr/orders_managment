/**
 * LEGEND: Canonical data-testid constants registry
 * Single source of truth for all data-testid attributes across the app.
 * Import from here in both components (to stamp) and tests (to query).
 * Organized by component slice, using kebab-case strings.
 */

export const TEST_IDS = {
  // ─── Order Sheet ──────────────────────────────────────────────────────────
  ORDER_SHEET: {
    /** The Sheet root element (SheetContent) */
    ROOT: "order-sheet",
    /** The floating trigger button that opens the sheet */
    TRIGGER: "order-sheet-trigger",
    /** Active-order summary badge shown in the trigger area */
    ACTIVE_ORDER_BADGE: "order-sheet-active-order-badge",
    /** Order count badge on the bag icon */
    COUNT_BADGE: "order-sheet-count-badge",
    /** "Add more products" close-and-return button */
    ADD_MORE_BTN: "order-sheet-add-more",
    /** Empty selection placeholder */
    EMPTY_SELECTION: "order-sheet-empty-selection",
  },

  // ─── Order List (inside sheet) ────────────────────────────────────────────
  ORDER_LIST: {
    /** Scrollable list container */
    CONTAINER: "order-list",
    /** Individual order row — append `:${order.id}` for specific rows */
    ROW: "order-list-row",
    /** Empty state message */
    EMPTY: "order-list-empty",    /** Bottom panel shown when >1 orders are selected */
    MULTI_ACTIONS_PANEL: "order-list-multi-actions",
    /** Combine selected orders into first button */
    MULTI_COMBINE_BTN: "order-list-multi-combine",
    /** Close all selected orders button */
    MULTI_CLOSE_BTN: "order-list-multi-close",
    /** Deselect all button */
    MULTI_CLEAR_BTN: "order-list-multi-clear",  },

  // ─── Order Details (receipt panel inside sheet) ───────────────────────────
  ORDER_DETAILS: {
    /** The details card wrapper */
    ROOT: "order-details",
    /** Close (X) button that fires close-order-details event */
    CLOSE_BTN: "order-details-close",
  },

  // ─── Order Controls (status filter toggle) ────────────────────────────────
  ORDER_CONTROLS: {
    /** ToggleGroup root */
    ROOT: "order-controls",
    /** "Opened" filter toggle */
    FILTER_OPENED: "order-controls-filter-opened",
    /** "Closed" filter toggle */
    FILTER_CLOSED: "order-controls-filter-closed",
  },

  // ─── Receipt Actions (action buttons on the receipt form) ─────────────────
  RECEIPT_ACTIONS: {
    /** Wrapper bar */
    ROOT: "receipt-actions",
    /** Split order button */
    SPLIT: "receipt-actions-split",
    /** Toggle payment method button */
    TOGGLE_PAYMENT: "receipt-actions-toggle-payment",
    /** Toggle takeaway button */
    TOGGLE_TAKEAWAY: "receipt-actions-toggle-takeaway",
    /** Remove selected items button */
    REMOVE: "receipt-actions-remove",
    /** Reset / cancel selections button */
    RESET: "receipt-actions-reset",
    /** Close order button */
    CLOSE_ORDER: "receipt-actions-close-order",
  },

  // ─── Product Card ─────────────────────────────────────────────────────────
  PRODUCT_CARD: {
    /** Card root — append `:${product.id}` for specific cards */
    ROOT: "product-card",
    /** "Add to order" / stepper wrapper */
    ORDER_CONTROLS: "product-card-order-controls",
    /** Minus / decrement button */
    DECREMENT: "product-card-decrement",
    /** Current quantity display */
    QUANTITY: "product-card-quantity",
    /** Plus / increment button */
    INCREMENT: "product-card-increment",
    /** "Add" button when product is not yet in order */
    ADD: "product-card-add",
    /** "Create order" button when no order is active */
    CREATE_ORDER: "product-card-create-order",
  },

  // ─── Filter Controls ──────────────────────────────────────────────────────
  FILTER_CONTROLS: {
    /** Search input */
    SEARCH_INPUT: "filter-search-input",
    /** Clear search/reset button */
    RESET_BTN: "filter-reset-btn",
  },

  // ─── Tag List ─────────────────────────────────────────────────────────────
  TAG: {
    /** Individual tag button — append `:${tag}` for a specific tag */
    BUTTON: "tag-button",
  },

  // ─── Receipt ──────────────────────────────────────────────────────────────
  RECEIPT: {
    /** The `<form>` wrapping the receipt */
    FORM: "receipt-form",
  },
} as const;

/** Helper to build a dynamic testid with a suffix (e.g. row id, product id) */
export function tid(base: string, suffix: string | number): string {
  return `${base}:${suffix}`;
}
