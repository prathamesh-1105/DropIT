import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';
import { broadcastRoomEvent } from '@/lib/events';
import fs from 'fs/promises';
import path from 'path';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { action, memberId, newName, mediaId, mediaIds } = body;

    const result = await supabaseDb.findRoomByCode(code);
    if (!result) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { room } = result;

    if (action === 'DELETE_ROOM') {
      await supabaseDb.deleteRoom(room.id);

      try {
        const uploadDir = path.join(process.cwd(), 'uploads');
        await fs.rm(path.join(uploadDir, 'originals', room.id), { recursive: true, force: true });
        await fs.rm(path.join(uploadDir, 'previews', room.id), { recursive: true, force: true });
      } catch (e) {
        console.error('Error deleting upload folders:', e);
      }

      broadcastRoomEvent({
        roomId: room.id,
        type: 'ROOM_DELETED',
        timestamp: Date.now(),
      });

      return NextResponse.json({ success: true, message: 'Room deleted' });
    }

    if (action === 'DELETE_MEDIA' && mediaId) {
      const deleted = await supabaseDb.deleteMedia(mediaId);
      if (deleted) {
        try {
          if (deleted.storagePath) await fs.unlink(deleted.storagePath).catch(() => {});
          if (deleted.previewPath) await fs.unlink(deleted.previewPath).catch(() => {});
        } catch (e) {
          console.error('Error unlinking files:', e);
        }

        broadcastRoomEvent({
          roomId: room.id,
          type: 'ROOM_UPDATED',
          timestamp: Date.now(),
        });

        return NextResponse.json({ success: true, message: 'Media deleted' });
      }
    }

    if (action === 'DELETE_MULTIPLE_MEDIA' && Array.isArray(mediaIds) && mediaIds.length > 0) {
      const deletedList = await supabaseDb.deleteMultipleMedia(mediaIds);
      await Promise.all(
        deletedList.map(async (item) => {
          if (item.storagePath) await fs.unlink(item.storagePath).catch(() => {});
          if (item.previewPath) await fs.unlink(item.previewPath).catch(() => {});
        })
      );

      broadcastRoomEvent({
        roomId: room.id,
        type: 'ROOM_UPDATED',
        timestamp: Date.now(),
      });

      return NextResponse.json({ success: true, message: `${deletedList.length} items deleted` });
    }

    if (action === 'REMOVE_MEMBER' && memberId) {
      await supabaseDb.removeMember(memberId);

      broadcastRoomEvent({
        roomId: room.id,
        type: 'MEMBER_REMOVED',
        memberId,
        timestamp: Date.now(),
      });

      return NextResponse.json({ success: true, message: 'Member removed' });
    }

    if (action === 'RENAME_ROOM' && newName) {
      await supabaseDb.updateRoomName(room.id, newName.trim());

      broadcastRoomEvent({
        roomId: room.id,
        type: 'ROOM_UPDATED',
        timestamp: Date.now(),
      });

      return NextResponse.json({ success: true, message: 'Room renamed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error managing room:', err);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
