import { Delete, Split, X } from "lucide-react";
import { Button } from "../ui/button";

export const ReceiptActions = () => (<>
    <div className="flex flex-wrap gap-2 justify-between px-0 py-4 sticky bottom-0 bg-white">
        <Button variant="default" size="sm" type="submit" id="split">
            Dividir<Split />
        </Button>
        <Button variant="default" size="sm" type="submit" id="updatePayment">
            Metodo de pago 💳
        </Button>
        <Button variant="default" size="sm" type="submit" id="toggleTakeAway">
            Para llevar 🛍️
        </Button>
        <Button variant="default" size="sm" type="submit" id="remove">
            Quitar productos<Delete/>
        </Button>
        <Button
            variant="ghost"
            size="sm"
            type="reset"
        >
            <X/>
        </Button>
    </div>
</>)