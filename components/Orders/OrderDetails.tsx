import { OrderItemsFE } from "@/lib/types";
import Receipt from "../Receipt/Receipt";
import { Button } from "../ui/button";
import { X } from "lucide-react";

export default function OrderDetails({ order: selectedOrder, editMode = false }: { order: OrderItemsFE, editMode?: boolean }) {
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