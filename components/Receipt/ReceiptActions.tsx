import { useReceiptEdit } from "@/context/useReceiptEdit";
import { useOnLongPress } from "@/hooks/useOnLongPress";
import { TEST_IDS } from "@/lib/testIds";
import { Delete, Minus, Plus, Split, X } from "lucide-react";
import { Button } from "../ui/button";

/** All payment options available in the system (seeded in migration001). */
const PAYMENT_OPTIONS = [
  { id: 1, label: "Efectivo", icon: "💵" },
  { id: 2, label: "Transferencia", icon: "💳💸" },
  { id: 3, label: "Tarjeta de crédito", icon: "💳" },
  { id: 4, label: "Tarjeta de débito", icon: "💳" },
  { id: 5, label: "Pago móvil", icon: "💳📱" },
  { id: 6, label: "Criptomoneda", icon: "💳🟠" },
] as const;

export const ReceiptActions = () => {
  const {
    hasSelection,
    items,
    selectedItemIds,
    defaultPaymentOptionId,
    paymentPickerOpen,
    setPaymentPickerOpen,
    handleSetPaymentOption,
    handleTogglePayment,
    handleDecrementSelected,
    handleIncrementSelected,
  } = useReceiptEdit();
  const { startPress, endPress, didFire } = useOnLongPress();

  // Derive the icon the toggle button should show (= what it will set TO)
  const allSelectedAreDefault = (() => {
    if (!hasSelection) return false;
    return items.every((p) =>
      p.items.every(
        (it) =>
          !selectedItemIds.has(`${it.id}`) ||
          it.payment_option_id === defaultPaymentOptionId,
      ),
    );
  })();
  const preferredOptionIcon =
    PAYMENT_OPTIONS.find((it) => it.id === defaultPaymentOptionId)?.icon ??
    "💳";
  const toggleIcon = allSelectedAreDefault ? "💵" : preferredOptionIcon;

  // When long-press fires on the payment button → open picker instead of toggling
  const handlePaymentLongPress = startPress(() => {
    setPaymentPickerOpen(true);
  });

  // Tap handler: smart toggle (cash ↔ preferred non-cash)
  const handlePaymentTap = () => {
    if (didFire.current) {
      didFire.current = false;
      return; // long-press already handled it
    }
    handleTogglePayment();
  };

  return (
    <>
      <div
        className="flex flex-wrap gap-2 justify-between p-0 sticky bottom-0 bg-white"
        data-testid={TEST_IDS.RECEIPT_ACTIONS.ROOT}
      >
        {hasSelection && (
          <>
            <Button
              variant="default"
              size="sm"
              type="submit"
              id="split"
              data-testid={TEST_IDS.RECEIPT_ACTIONS.SPLIT}
            >
              Dividir
              <Split />
            </Button>

            {/* Inline swap: toggle button ↔ select picker */}
            {paymentPickerOpen ? (
              <select
                aria-label="Seleccionar método de pago"
                className="rounded-md border px-2 py-1 text-sm font-medium bg-white"
                defaultValue=""
                autoFocus
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) {
                    handleSetPaymentOption(id);
                  } else {
                    setPaymentPickerOpen(false);
                  }
                }}
              >
                <option value="" disabled>
                  Método de pago…
                </option>
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
                <option value="">✕ Cancelar</option>
              </select>
            ) : (
              <Button
                variant="default"
                size="sm"
                type="button"
                data-testid={TEST_IDS.RECEIPT_ACTIONS.TOGGLE_PAYMENT}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handlePaymentLongPress();
                }}
                onMouseDown={handlePaymentLongPress}
                onTouchEnd={endPress}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onClick={handlePaymentTap}
              >
                Metodo de pago {toggleIcon}
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              type="submit"
              id="toggleTakeAway"
              data-testid={TEST_IDS.RECEIPT_ACTIONS.TOGGLE_TAKEAWAY}
            >
              Para llevar 🛍️
            </Button>

            {/* Quantity controls: -, +, trash */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleDecrementSelected}
                title="Quitar uno de cada producto seleccionado"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleIncrementSelected}
                title="Agregar uno de cada producto seleccionado"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="submit"
                id="remove"
                data-testid={TEST_IDS.RECEIPT_ACTIONS.REMOVE}
                title="Quitar TODOS los productos seleccionados"
              >
                <Delete className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          type="reset"
          data-testid={TEST_IDS.RECEIPT_ACTIONS.RESET}
        >
          {hasSelection ? <X /> : "Finalizar edición"}
        </Button>
      </div>
    </>
  );
};
