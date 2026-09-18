import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';
import { broadcastRoomEvent } from '@/lib/events';
import { generateSecureToken, hashToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = checkRateLimit(req, 'join_room', 20, 60000);
  if (!rl.success) return rl.response!;

  try {
    const { code } = await params;
    const { displayName } = await req.json();

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: 'Member name is required' },
        { status: 400 }
      );
    }

    const result = await supabaseDb.findRoomByCode(code);
    if (!result) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { room, members } = result;

    // Check if existing member in room with same name already has a token
    const existingMember = members.find(
      (m) => m.displayName.toLowerCase() === displayName.trim().toLowerCase()
    );

    const memberToken = generateSecureToken();
    const tokenHash = hashToken(memberToken);

    const isCreator = room.createdBy && room.createdBy.toLowerCase() === displayName.trim().toLowerCase();
    const role = (existingMember?.role === 'OWNER' || isCreator) ? 'OWNER' : 'MEMBER';

    const member = await supabaseDb.addMember(room.id, displayName.trim(), tokenHash, role);

    broadcastRoomEvent({
      roomId: room.id,
      type: 'MEMBER_JOINED',
      memberId: member.id,
      memberName: member.displayName,
      timestamp: Date.now(),
    });

    const res = NextResponse.json({
      success: true,
      roomId: room.id,
      roomCode: room.code,
      memberId: member.id,
      displayName: member.displayName,
      token: memberToken,
      role: member.role || role,
    });

    res.headers.append(
      'Set-Cookie',
      `drop_token_${room.code}=${memberToken}; Path=/; SameSite=Lax; Max-Age=31536000`
    );

    return res;
  } catch (err: any) {
    console.error('Error joining room:', err);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}

