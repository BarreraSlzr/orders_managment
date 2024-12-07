"use client"

import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Search } from 'lucide-react'
import { useOrderItemsProducts } from "@/hooks/useOrderItemsProducts"
import { FilterControls } from "../FilterControls"
import { useProductsFilter } from "@/context/useProductsFilter"

interface OrderSummaryProps {
}

export function TagsSheet({ }: OrderSummaryProps) {
    const { selectedTags } = useProductsFilter()

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button className="fixed bottom-4 left-4 h-16 w-16 rounded-full">
                    <Search className="h-6 w-6" />
                    <span className="absolute -left-2 -top-2 h-6 w-6 rounded-full bg-primary text-primary-foreground">
                        {selectedTags.size}
                    </span>
                </Button>
            </SheetTrigger>
            <SheetContent side='bottom' className="mx-auto flex w-full flex-col sm:max-w-lg">
                <SheetHeader className="space-y-4">
                    <SheetTitle className="text-center text-xl font-bold">
                        TAGS
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 overflow-auto min-h-full">
                    {/* Orders List */}
                    <FilterControls />
                    <div className="m-auto"/>
                </div>
            </SheetContent>
        </Sheet>
    )
}

