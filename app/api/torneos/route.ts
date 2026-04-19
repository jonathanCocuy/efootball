import { NextRequest, NextResponse } from 'next/server';
import { getTorneos, createTorneo } from '@/lib/store';

export async function GET() {
  try {
    return NextResponse.json(await getTorneos());
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, tipo } = await req.json();
    const torneo = await createTorneo(nombre, tipo);
    return NextResponse.json(torneo, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
