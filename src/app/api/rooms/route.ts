import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${p1}-${p2}`;
}

export async function POST(req: Request) {
  try {
    const { roomName, creatorName } = await req.json();

    if (!roomName || !creatorName) {
      return NextResponse.json(
        { error: 'Room name and creator name are required' },
        { status: 400 }
      );
    }

    let code = generateRoomCode();
    let existing = await supabaseDb.findRoomByCode(code);
    while (existing) {
      code = generateRoomCode();
      existing = await supabaseDb.findRoomByCode(code);
    }

    const { room, creatorMember } = await supabaseDb.createRoom(
      roomName.trim(),
      code,
      creatorName.trim()
    );

    return NextResponse.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      roomName: room.name,
      creatorMemberId: creatorMember.id,
    });
  } catch (err: any) {
    console.error('Error creating room:', err);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
