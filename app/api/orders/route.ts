import { getOpenOrders } from '@/lib/sql/functions/getOpenOrders';
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const orders = await getOpenOrders();
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching open orders:', error)
    return NextResponse.json({ error: 'Failed to fetch open orders' }, { status: 500 })
  }
}