import { TEST_IDS } from "@/lib/testIds";
import { Delete, Split, X } from "lucide-react";
import { Button } from "../ui/button";

export const ReceiptActions = () => (
  <>
    <div
      className="flex flex-wrap gap-2 justify-between px-0 py-4 sticky bottom-0 bg-white"
      data-testid={TEST_IDS.RECEIPT_ACTIONS.ROOT}
    >
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
      <Button
        variant="default"
        size="sm"
        type="submit"
        id="updatePayment"
        data-testid={TEST_IDS.RECEIPT_ACTIONS.TOGGLE_PAYMENT}
      >
        Metodo de pago 💳
      </Button>
      <Button
        variant="default"
        size="sm"
        type="submit"
        id="toggleTakeAway"
        data-testid={TEST_IDS.RECEIPT_ACTIONS.TOGGLE_TAKEAWAY}
      >
        Para llevar 🛍️
      </Button>
      <Button
        variant="destructive"
        size="sm"
        type="submit"
        id="remove"
        data-testid={TEST_IDS.RECEIPT_ACTIONS.REMOVE}
      >
        Quitar productos
        <Delete />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="reset"
        data-testid={TEST_IDS.RECEIPT_ACTIONS.RESET}
      >
        <X />
      </Button>
    </div>
  </>
);
