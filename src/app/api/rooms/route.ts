import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';
import { jsonDb } from '@/lib/jsonDb';
import { generateCryptographicRoomCode, generateSecureToken, hashToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'create_room', 10, 60000);
  if (!rl.success) return rl.response!;

  try {
    const { roomName, creatorName } = await req.json();

    if (!roomName || !creatorName || !roomName.trim() || !creatorName.trim()) {
      return NextResponse.json(
        { error: 'Room name and creator name are required' },
        { status: 400 }
      );
    }

    let code = generateCryptographicRoomCode();
    let existing = jsonDb.findRoomByCode(code);
    while (existing) {
      code = generateCryptographicRoomCode();
      existing = jsonDb.findRoomByCode(code);
    }

    const ownerToken = generateSecureToken();
    const tokenHash = hashToken(ownerToken);

    const { room, creatorMember } = await supabaseDb.createRoom(
      roomName.trim(),
      code,
      creatorName.trim(),
      tokenHash
    );

    const res = NextResponse.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      roomName: room.name,
      creatorMemberId: creatorMember.id,
      token: ownerToken,
    });

    res.headers.append(
      'Set-Cookie',
      `drop_token_${room.code}=${ownerToken}; Path=/; SameSite=Lax; Max-Age=31536000`
    );

    return res;
  } catch (err: any) {
    console.error('Error creating room:', err);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

