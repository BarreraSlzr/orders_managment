import { getItems } from '@/lib/sql/functions/inventory';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get('category')?.toString();

  const items = await getItems(categoryId);

  return NextResponse.json(items);
}