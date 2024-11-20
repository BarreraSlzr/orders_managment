import { getProducts } from '@/lib/sql/functions/getProducts'
import { seed } from '@/lib/sql/seed'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    await seed();
    let products = await getProducts();
    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}