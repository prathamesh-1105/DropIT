import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { supabaseDb } from '@/lib/supabase';
import {
  getChunkFilePath,
  getOriginalFilePath,
  getPreviewFilePath,
  clearChunks,
} from '@/lib/storage';
import { calculateFileHash } from '@/lib/checksum';
import { generatePreview } from '@/lib/thumbnail';
import { broadcastRoomEvent } from '@/lib/events';
import { verifyRoomMember } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      uploadId,
      roomId,
      memberId,
      originalFilename,
      mimeType,
      size,
      checksum,
      width,
      height,
      duration,
      cloud,
      fileId: customFileId,
      storagePath: customStoragePath,
      previewPath: customPreviewPath,
      token: bodyToken,
    } = body;

    if (!roomId || !memberId || !originalFilename) {
      return NextResponse.json(
        { error: 'Missing completion parameters' },
        { status: 400 }
      );
    }

    const auth = await verifyRoomMember(req, roomId, bodyToken);
    if (!auth.authenticated || !auth.member) {
      return NextResponse.json({ error: auth.error || 'Access denied.' }, { status: 401 });
    }

    if (auth.member.id !== memberId && auth.member.roomId !== auth.room?.id) {
      return NextResponse.json({ error: 'Access denied. Member mismatch.' }, { status: 403 });
    }

    const effectiveMemberId = auth.member.id;

    // Direct Cloud Upload Completion Path
    if (cloud && customStoragePath) {
      const fileId = customFileId || Math.random().toString(36).substring(2, 11);

      const media = await supabaseDb.addMedia({
        id: fileId,
        roomId,
        memberId: effectiveMemberId,
        originalFilename,
        mimeType: mimeType || 'application/octet-stream',
        size: Number(size),
        storagePath: customStoragePath,
        previewPath: customPreviewPath || null,
        checksum: checksum || '',
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        duration: duration ? Number(duration) : undefined,
      });

      const roomRes = await supabaseDb.findRoomById(roomId);
      const roomDetails = roomRes ? await supabaseDb.findRoomByCode(roomRes.code) : null;
      const memberName = roomDetails?.members.find((m) => m.id === memberId)?.displayName || 'Someone';

      broadcastRoomEvent({
        roomId,
        type: 'MEDIA_ADDED',
        memberId,
        memberName,
        filename: originalFilename,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        mediaId: media.id,
        checksum: media.checksum,
      });
    }

    // Local Disk Chunk Assembly Fallback Path
    if (!uploadId) {
      return NextResponse.json(
        { error: 'Missing uploadId parameter for chunk assembly' },
        { status: 400 }
      );
    }

    const fileId = Math.random().toString(36).substring(2, 11);
    const destinationPath = getOriginalFilePath(
      roomId,
      memberId,
      fileId,
      originalFilename
    );
    const isVideo = (mimeType || '').startsWith('video/');
    const previewPath = isVideo ? destinationPath : getPreviewFilePath(roomId, fileId);

    const chunkDir = path.dirname(getChunkFilePath(uploadId, 0));
    if (!fsSync.existsSync(chunkDir)) {
      return NextResponse.json(
        { error: 'Upload chunks not found' },
        { status: 404 }
      );
    }

    const chunkFiles = (await fs.readdir(chunkDir))
      .filter((f) => f.startsWith('chunk_'))
      .sort((a, b) => {
        const idxA = parseInt(a.split('_')[1], 10);
        const idxB = parseInt(b.split('_')[1], 10);
        return idxA - idxB;
      });

    const destDir = path.dirname(destinationPath);
    if (!fsSync.existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true });
    }

    // Fast assembly: if single chunk, move/rename directly; otherwise stream chunks sequentially
    if (chunkFiles.length === 1) {
      const singleChunkPath = path.join(chunkDir, chunkFiles[0]);
      await fs.copyFile(singleChunkPath, destinationPath);
    } else {
      const destHandle = await fs.open(destinationPath, 'w');
      for (const chunkFile of chunkFiles) {
        const chunkPath = path.join(chunkDir, chunkFile);
        const chunkBuffer = await fs.readFile(chunkPath);
        await destHandle.write(chunkBuffer);
      }
      await destHandle.close();
    }

    // Asynchronously clear temporary chunks
    clearChunks(uploadId).catch((e) => console.error(e));

    // Non-blocking background hash calculation & preview generation
    calculateFileHash(destinationPath).catch(() => {});
    if (!isVideo) {
      generatePreview(destinationPath, previewPath, mimeType).catch((e) => console.error(e));
    }

    const media = await supabaseDb.addMedia({
      id: fileId,
      roomId,
      memberId: effectiveMemberId,
      originalFilename,
      mimeType,
      size: Number(size),
      storagePath: destinationPath,
      previewPath: previewPath,
      checksum: checksum || '',
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      duration: duration ? Number(duration) : undefined,
    });

    const roomRes = await supabaseDb.findRoomById(roomId);
    const roomDetails = roomRes ? await supabaseDb.findRoomByCode(roomRes.code) : null;
    const memberName = roomDetails?.members.find((m) => m.id === memberId)?.displayName || 'Someone';

    broadcastRoomEvent({
      roomId,
      type: 'MEDIA_ADDED',
      memberId,
      memberName,
      filename: originalFilename,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      mediaId: media.id,
      checksum: media.checksum,
    });
  } catch (err: any) {
    console.error('Error completing upload:', err);
    return NextResponse.json(
      { error: 'Failed to assemble file' },
      { status: 500 }
    );
  }
}

