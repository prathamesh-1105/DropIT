import { NextResponse } from 'next/server';
import { jsonDb } from '@/lib/jsonDb';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const result = jsonDb.findRoomByCode(code);

    if (!result) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { room, members, mediaItems } = result;

    const membersSummary = members.map((m) => {
      const memberMedia = mediaItems.filter((item) => item.memberId === m.id);
      const totalSize = memberMedia.reduce((acc, curr) => acc + Number(curr.size), 0);
      return {
        id: m.id,
        displayName: m.displayName,
        joinedAt: m.joinedAt,
        itemCount: memberMedia.length,
        totalSize,
      };
    });

    const totalItemsCount = mediaItems.length;
    const totalStorageBytes = mediaItems.reduce(
      (acc, curr) => acc + Number(curr.size),
      0
    );

    const sortedMedia = [...mediaItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const mediaFormatted = sortedMedia.map((m) => {
      const member = members.find((mem) => mem.id === m.memberId);
      return {
        id: m.id,
        originalFilename: m.originalFilename,
        mimeType: m.mimeType,
        size: m.size,
        checksum: m.checksum,
        width: m.width,
        height: m.height,
        duration: m.duration,
        createdAt: m.createdAt,
        memberId: m.memberId,
        memberName: member ? member.displayName : 'Unknown',
        previewUrl: `/api/media/${m.id}/preview`,
        originalUrl: `/api/media/${m.id}/original`,
      };
    });

    return NextResponse.json({
      roomId: room.id,
      roomCode: room.code,
      name: room.name,
      createdAt: room.createdAt,
      createdBy: room.createdBy,
      totalMembers: members.length,
      totalItemsCount,
      totalStorageBytes,
      members: membersSummary,
      mediaItems: mediaFormatted,
    });
  } catch (err: any) {
    console.error('Error fetching room:', err);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}
