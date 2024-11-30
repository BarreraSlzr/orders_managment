import { handleUpsertProduct } from '@/app/actions';
import { db } from '@/lib/sql/database';
import { getProducts } from '@/lib/sql/functions/getProducts'
import { upsertProduct } from '@/lib/sql/functions/upsertProduct';
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const products = await getProducts();
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const response = await handleUpsertProduct(formData);
    return NextResponse.json(response);
  } catch (error) {
    console.log(JSON.stringify(error));
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get('id')?.toString();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Product ID is required' }, { status: 400 });
    }

    return await db.deleteFrom('products').where('id', '=', id).execute()
    .then(() => {
      return NextResponse.json({ success: true, id });
    })
    .catch((error) => {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: JSON.stringify(error) }, { status: 500 });
  }
}
