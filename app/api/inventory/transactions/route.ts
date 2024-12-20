import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/sql/functions/transactions';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('itemId');

  if (!itemId) {
    return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
  }

  const transactions = await getTransactions(itemId);

  return NextResponse.json(transactions);
}
