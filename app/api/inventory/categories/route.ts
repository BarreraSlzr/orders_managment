import { getCategories } from '@/lib/sql/functions/categories';
import { NextResponse } from 'next/server';

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories);
}
