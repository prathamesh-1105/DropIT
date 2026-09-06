import { NextResponse } from 'next/server';
import { jsonDb } from '@/lib/jsonDb';
import { broadcastRoomEvent } from '@/lib/events';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { displayName } = await req.json();

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: 'Member name is required' },
        { status: 400 }
      );
    }

    const result = jsonDb.findRoomByCode(code);
    if (!result) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { room } = result;
    const member = jsonDb.addMember(room.id, displayName.trim());

    broadcastRoomEvent({
      roomId: room.id,
      type: 'MEMBER_JOINED',
      memberId: member.id,
      memberName: member.displayName,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      roomId: room.id,
      roomCode: room.code,
      memberId: member.id,
      displayName: member.displayName,
    });
  } catch (err: any) {
    console.error('Error joining room:', err);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}
