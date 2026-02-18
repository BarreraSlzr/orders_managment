import Receipt from "../Receipt/Receipt";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { OrderItemsView } from "@/lib/sql/types";
import { TEST_IDS } from "@/lib/testIds";

export default function OrderDetails({
  order: selectedOrder,
  editMode = false,
}: {
  order: OrderItemsView;
  editMode?: boolean;
}) {
  return (
    <div
      className="relative max-h-[80vh] overflow-auto"
      data-testid={TEST_IDS.ORDER_DETAILS.ROOT}
    >
      <Receipt data={selectedOrder} editMode={editMode} />
      <Button
        className="absolute top-0 right-0"
        variant="ghost"
        data-testid={TEST_IDS.ORDER_DETAILS.CLOSE_BTN}
        onClick={() => {
          window.dispatchEvent(new Event("close-order-details"));
        }}
      >
        <X />
      </Button>
    </div>
  );
}
