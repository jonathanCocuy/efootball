import { NextRequest, NextResponse } from 'next/server';
import { getAll, insert } from '@/lib/store';

export async function GET() {
  try {
    return NextResponse.json(await getAll('partidos'));
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = await insert('partidos', body);
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
