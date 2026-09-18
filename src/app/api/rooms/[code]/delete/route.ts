import { NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase';
import { broadcastRoomEvent } from '@/lib/events';
import { deleteStorageObjects } from '@/lib/storage';
import { verifyRoomMember } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import fs from 'fs/promises';
import path from 'path';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = checkRateLimit(req, 'delete_action', 30, 60000);
  if (!rl.success) return rl.response!;

  try {
    const { code } = await params;
    const body = await req.json();
    const { action, memberId, newName, mediaId, mediaIds, token: bodyToken } = body;

    const auth = await verifyRoomMember(req, code, bodyToken);
    if (!auth.authenticated || !auth.member) {
      return NextResponse.json({ error: auth.error || 'Access denied.' }, { status: 401 });
    }

    const result = await supabaseDb.findRoomByCode(code);
    if (!result) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { room, mediaItems } = result;

    if (action === 'DELETE_ROOM') {
      if (!auth.isOwner) {
        return NextResponse.json({ error: 'Access denied. Only room owner can delete room.' }, { status: 403 });
      }

      // Clean up all media items associated with the room
      const allPaths = mediaItems.flatMap((m) => [m.storagePath, m.previewPath]);
      await deleteStorageObjects(allPaths);

      await supabaseDb.deleteRoom(room.id);

      try {
        const uploadDir = path.join(process.cwd(), 'uploads');
        await fs.rm(path.join(uploadDir, 'originals', room.id), { recursive: true, force: true }).catch(() => {});
        await fs.rm(path.join(uploadDir, 'previews', room.id), { recursive: true, force: true }).catch(() => {});
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
      const mediaItem = mediaItems.find((m) => m.id === mediaId);
      if (!mediaItem) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }

      if (!auth.isOwner && mediaItem.memberId !== auth.member.id) {
        return NextResponse.json({ error: 'Access denied. Cannot delete another user media.' }, { status: 403 });
      }

      const deleted = await supabaseDb.deleteMedia(mediaId);
      if (deleted) {
        await deleteStorageObjects([deleted.storagePath, deleted.previewPath]);

        broadcastRoomEvent({
          roomId: room.id,
          type: 'ROOM_UPDATED',
          timestamp: Date.now(),
        });

        return NextResponse.json({ success: true, message: 'Media deleted' });
      }
    }

    if (action === 'DELETE_MULTIPLE_MEDIA' && Array.isArray(mediaIds) && mediaIds.length > 0) {
      const targetMedia = mediaItems.filter((m) => mediaIds.includes(m.id));
      if (!auth.isOwner) {
        const hasUnowned = targetMedia.some((m) => m.memberId !== auth.member!.id);
        if (hasUnowned) {
          return NextResponse.json({ error: 'Access denied. Cannot delete media uploaded by others.' }, { status: 403 });
        }
      }

      const deletedList = await supabaseDb.deleteMultipleMedia(mediaIds);
      const pathsToDelete = deletedList.flatMap((item) => [item.storagePath, item.previewPath]);
      await deleteStorageObjects(pathsToDelete);

      broadcastRoomEvent({
        roomId: room.id,
        type: 'ROOM_UPDATED',
        timestamp: Date.now(),
      });

      return NextResponse.json({ success: true, message: `${deletedList.length} items deleted` });
    }

    if (action === 'REMOVE_MEMBER' && memberId) {
      if (!auth.isOwner) {
        return NextResponse.json({ error: 'Access denied. Only room owner can remove members.' }, { status: 403 });
      }

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
      if (!auth.isOwner) {
        return NextResponse.json({ error: 'Access denied. Only room owner can rename room.' }, { status: 403 });
      }

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


