import { getUniqueTags } from '@/lib/sql/functions/getUniqueTags'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const tags = await getUniqueTags();
    return NextResponse.json(tags.map(r => r.tag))
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}