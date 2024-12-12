import { useProducts } from "@/context/useProducts"
import { Plus } from 'lucide-react'

export default function EmptyState() {
    const { products, currentProduct ,handleEditProduct} = useProducts()
    return (
        !currentProduct &&
        <div
            className="border-4 border-dashed border-blue-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-blue-100"
            onClick={() => handleEditProduct(null as any)}>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay productos relacionados</h3>
            <p className="text-sm text-gray-500 text-center mb-4">{products.size === 0 ? 'Comienza' : 'Continua'} agregando productos para completar tu inventario</p>
        </div>
    )
}

