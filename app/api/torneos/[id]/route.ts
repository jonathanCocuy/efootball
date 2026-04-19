import { NextRequest, NextResponse } from 'next/server';
import { deleteTorneo } from '@/lib/store';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = await deleteTorneo(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
