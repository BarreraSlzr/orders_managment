import { handleUpsertProduct as serverUpsertProduct } from "@/app/actions";
import { Product, ProductContextType } from "@/lib/types";
import { Updateable } from "kysely";
import { useState, startTransition, useEffect } from "react";

const defaultProduct = {
    id: '', // Temporary empty ID until the product is saved
    name: '',
    price: 0,
    tags: '',
}

export function useProducts({ products: defaultProducts }: { products: Product[] }): ProductContextType {
    const [products, setProducts] = useState<Map<string, Product>>(new Map(defaultProducts.map(p => [p.id, p])));
    const [currentProduct, setCurrentProduct] = useState<Updateable<Product>>({ ...defaultProduct });

    // Fetching products
    const fetchProducts = async () => {
        const response = await fetch('/api/products')
        if (!response.ok) throw new Error('Failed to fetch products')
        return response.json() as unknown as Product[]
    }

    useEffect(() => {
        async function fetchAll() {
            const products = await fetchProducts()
            startTransition(() => {
                setProducts(new Map(products.map(p => [p.id, p])))
            })
        }
        fetchAll();
    }, [])

    return {
        products,
        currentProduct,
        handleEditProduct: (products: Updateable<Product> = { ...defaultProduct }) => {
            setCurrentProduct({...products});
        },
        handleUpsertProduct: async (formData: FormData) => {
            const response = await serverUpsertProduct(formData);
            if (!response.success) throw new Error('Failed to upsert product');
            const updatedProduct = response.result.product as Product;

            startTransition(() => {
                products.set(updatedProduct.id, updatedProduct);
                setProducts(new Map(products));
            });
        },
        handleDeleteProduct: async (formData: FormData) => {
            const response = await fetch(`/api/products`, {
                method: 'DELETE',
                body: formData,
            });
            if (!response.ok) throw new Error('Failed to delete product');
            const { id: deletedProductId } = await response.json() as { id: string };

            startTransition(() => {
                const updatedProducts = new Map(products);
                updatedProducts.delete(deletedProductId);
                setProducts(updatedProducts);

                if (currentProduct?.id === deletedProductId) {
                    setCurrentProduct({ ...defaultProduct });
                }
            });
        }
    }
}