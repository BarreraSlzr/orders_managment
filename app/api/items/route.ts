import { getAllItems } from '@/lib/sql/functions/todoList';
import { NextResponse } from 'next/server';

export async function GET() {
  const items = await getAllItems();
  return NextResponse.json(items);
}