import Receipt from "../Receipt/Receipt";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { OrderItemsView } from "@/lib/sql/types";

export default function OrderDetails({ order: selectedOrder, editMode = false }: { order: OrderItemsView, editMode?: boolean }) {
    return (
        <div className="relative">
            <Receipt data={selectedOrder} editMode={editMode}/>
            <Button
                className="absolute top-0 right-0"
                variant="ghost"
                onClick={() => {
                    window.dispatchEvent(new Event("close-order-details"));
                }}
            >
                <X />
            </Button>
        </div>
    );
}