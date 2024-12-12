import { Sun } from 'lucide-react'

export default function EmptyOrders() {
    return (
        <div
            className="border-4 border-dashed border-amber-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-amber-100"
        >
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <Sun className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">¡Buenos días!</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Aún no hay órdenes. ¡El día está por comenzar!</p>
        </div>
    )
}

