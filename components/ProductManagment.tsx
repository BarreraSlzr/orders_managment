'use client'
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from './ui/input';
import { useProducts } from '@/context/useProducts';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from "date-fns/locale/es";

export default function ProductOrderManagment() {
    const {
        products,
        currentProduct,
        handleDeleteProduct,
        handleEditProduct,
        handleUpsertProduct
    } = useProducts();

    return (
        <div className="max-w-md mx-auto space-y-4 h-screen flex flex-col justify-between">
            <main className='p-4 pb-10 flex flex-wrap gap-2'>
                {Array.from(products.values()).map(product => (
                    <div
                        className='flex-grow'
                        key={product.id}>
                        <ProductCard
                            product={product}
                        >
                            <Button size="sm" onClick={() => handleEditProduct(product)}>
                                Editar
                            </Button>
                        </ProductCard>
                    </div>
                ))}
            </main>
            <footer className="sticky bottom-0 translate-y-2 pb-2 max-w-md w-full">
                <Card className="w-full">
                    <CardHeader>
                        <p className="font-bold">Información de producto</p>
                        {(currentProduct.id && currentProduct.updated) && (<>
                            <pre className='font-mono text-xs'>{currentProduct.id}</pre>
                            <pre className='font-mono text-xs'>{format(currentProduct.updated, "EEEE, MMMM dd, yyyy, p", { locale: es }).toUpperCase()}</pre>
                        </>)}
                    </CardHeader>
                    <CardContent>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(ev) => {
                                ev.preventDefault();
                                const formData = new FormData(ev.currentTarget);
                                if (currentProduct.id) {
                                    formData.append('id', currentProduct.id);
                                }
                                handleUpsertProduct(formData);
                            }}
                            onReset={() => {
                                if (currentProduct?.id) {
                                    const formData = new FormData();
                                    formData.append('id', currentProduct.id);
                                    handleDeleteProduct(formData);
                                } else {
                                    handleEditProduct();
                                }
                            }}
                        >
                            <div className="flex flex-col gap-3">
                                <Input
                                    key={`${currentProduct.id}-name`}
                                    required
                                    id="name"
                                    name="name"
                                    placeholder="Nombre del producto"
                                    defaultValue={currentProduct.name}
                                />
                                <Input
                                    key={`${currentProduct.id}-price`}
                                    required
                                    type="number"
                                    step="0.01"
                                    id="price"
                                    name="price"
                                    placeholder="Precio"
                                    defaultValue={currentProduct.price}
                                />
                                <Input
                                    key={`${currentProduct.id}-tags`}
                                    required
                                    id="tags"
                                    name="tags"
                                    placeholder="Etiquetas (separadas por comas)"
                                    defaultValue={currentProduct.tags}
                                />
                            </div>
                            <div className="flex justify-between items-center gap-3">
                                <Button type='button' variant="outline" onClick={() => handleEditProduct()}>
                                    {currentProduct.id ? <X /> : 'Crear producto'}
                                </Button>
                                <Button type="submit" variant="secondary">
                                    Guardar producto
                                </Button>
                                {currentProduct.id && (
                                    <Button type="reset" variant="destructive">
                                        Eliminar producto
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </footer>

        </div>
    );
}
