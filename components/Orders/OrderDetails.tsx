import { OrderItemsView } from "@/lib/sql/types";
import { TEST_IDS } from "@/lib/testIds";
import { X } from "lucide-react";
import Receipt from "../Receipt/Receipt";
import { Button } from "../ui/button";

export default function OrderDetails({
  order: selectedOrder,
  editMode = false,
}: {
  order: OrderItemsView;
  editMode?: boolean;
}) {
  return (
    <div
      className="relative h-full min-h-0 overflow-visible"
      data-testid={TEST_IDS.ORDER_DETAILS.ROOT}
    >
      <Receipt data={selectedOrder} editMode={editMode} />
      <Button
        className="absolute right-2 top-2 z-40 h-8 w-8 rounded-full border border-slate-200 bg-white/95 p-0 text-slate-700 shadow-sm hover:bg-white"
        variant="ghost"
        data-testid={TEST_IDS.ORDER_DETAILS.CLOSE_BTN}
        onClick={() => {
          window.dispatchEvent(new Event("close-order-details"));
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
