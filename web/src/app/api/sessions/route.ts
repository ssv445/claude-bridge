import { NextRequest, NextResponse } from 'next/server';
import { listSessionsWithInfo, newSession, killSession } from '@/lib/tmux';

export async function GET() {
  const sessions = await listSessionsWithInfo();
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { name, workingDir } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  try {
    await newSession(name, workingDir);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  try {
    await killSession(name);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to kill session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
