'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useProducts } from "@/context/useProducts"
import { Product } from "@/lib/types"
import { formatDate } from "@/lib/utils/formatDate"
import { X } from "lucide-react"

export const ProductForm = ({ product }: { product: Product; }) => {
    const { handleDeleteProduct, handleUpsertProduct, handleEditProduct } = useProducts()

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget);
        formData.set('id', product.id);
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
        const submitType = submitter.id

        if (submitType === 'save') {
            await handleUpsertProduct(formData);
        } else if (submitType === 'delete') {
            await handleDeleteProduct(formData);
        }
    }

    const removeCurrentProduct = () => handleEditProduct();

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="relative">
                <CardTitle className="text-2xl font-bold">{product.id ? 'Editar' : 'Crear'} Producto</CardTitle>
                {(product.id && product.updated) && (<>
                    <pre className='font-mono text-xs'>{product.id}</pre>
                    <pre className='font-mono text-xs'>{formatDate(new Date(product.updated))}</pre>
                </>)}
                <Button variant={'ghost'} className="absolute top-0 right-0" onClick={removeCurrentProduct}><X /></Button>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} onReset={removeCurrentProduct} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input key={product.id + 'name'} type="text" id="name" name="name" defaultValue={product.name} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price">Precio</Label>
                        <Input key={product.id + 'price'} type="number" id="price" name="price" defaultValue={product.price} step="0.01" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tags">Tags (Separados por comas)</Label>
                        <Input key={product.id + 'tags'} type="text" id="tags" name="tags" defaultValue={product.tags} />
                    </div>
                    <div className="flex justify-between pt-4">
                        <Button type="submit" id="save">
                            Guardar
                        </Button>
                        {
                            product.id &&
                            <Button type="submit" id="delete" variant="destructive">
                                Eliminar
                            </Button>
                        }
                        <Button type="reset" variant="outline">
                            Cancelar
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

export const ShowCurrentProductForm = () => {
    const { currentProduct } = useProducts();
    return (
        currentProduct && <ProductForm product={currentProduct as Product} />
    )
}