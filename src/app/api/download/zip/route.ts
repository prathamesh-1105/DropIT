import { NextResponse } from 'next/server';
import { jsonDb } from '@/lib/jsonDb';
import { createZeroLossZipBuffer, ZipMediaItem } from '@/lib/zip';

export async function POST(req: Request) {
  try {
    const { roomId, memberId, mediaIds } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const room = jsonDb.findRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const roomData = jsonDb.findRoomByCode(room.code);
    if (!roomData) {
      return NextResponse.json({ error: 'Room details not found' }, { status: 404 });
    }

    let mediaRecords = roomData.mediaItems;

    if (memberId) {
      mediaRecords = mediaRecords.filter((m) => m.memberId === memberId);
    } else if (Array.isArray(mediaIds) && mediaIds.length > 0) {
      mediaRecords = mediaRecords.filter((m) => mediaIds.includes(m.id));
    }

    if (mediaRecords.length === 0) {
      return NextResponse.json({ error: 'No media items to zip' }, { status: 400 });
    }

    const zipItems: ZipMediaItem[] = mediaRecords.map((m) => {
      const member = roomData.members.find((mem) => mem.id === m.memberId);
      return {
        id: m.id,
        originalFilename: m.originalFilename,
        storagePath: m.storagePath,
        memberName: member ? member.displayName : 'Unknown',
      };
    });

    const zipBuffer = await createZeroLossZipBuffer(room.name, zipItems);
    const sanitizedRoomName = room.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${sanitizedRoomName}-ZeroLoss.zip`;

    const uint8Array = new Uint8Array(zipBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Error generating zero-loss ZIP:', err);
    return NextResponse.json(
      { error: 'Failed to generate ZIP' },
      { status: 500 }
    );
  }
}
