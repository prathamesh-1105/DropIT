import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { jsonDb } from '@/lib/jsonDb';
import {
  getChunkFilePath,
  getOriginalFilePath,
  getPreviewFilePath,
  clearChunks,
} from '@/lib/storage';
import { calculateFileHash, verifyChecksum } from '@/lib/checksum';
import { generatePreview } from '@/lib/thumbnail';
import { broadcastRoomEvent } from '@/lib/events';

export async function POST(req: Request) {
  try {
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
    } = await req.json();

    if (!uploadId || !roomId || !memberId || !originalFilename) {
      return NextResponse.json(
        { error: 'Missing completion parameters' },
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
    const previewPath = getPreviewFilePath(roomId, fileId);

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

    // Write untouched original file
    const destHandle = await fs.open(destinationPath, 'w');
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(chunkDir, chunkFile);
      const chunkBuffer = await fs.readFile(chunkPath);
      await destHandle.write(chunkBuffer);
    }
    await destHandle.close();

    // Asynchronously clear temporary chunks
    clearChunks(uploadId).catch((e) => console.error(e));

    // Fast SHA-256 calculation / fallback
    const serverHash = await calculateFileHash(destinationPath).catch(() => checksum || '');

    // Non-blocking preview generation in background for maximum speed
    generatePreview(destinationPath, previewPath, mimeType).catch((e) => console.error(e));

    const media = jsonDb.addMedia({
      id: fileId,
      roomId,
      memberId,
      originalFilename,
      mimeType,
      size: Number(size),
      storagePath: destinationPath,
      previewPath: previewPath,
      checksum: serverHash || checksum || '',
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      duration: duration ? Number(duration) : undefined,
    });

    const roomRes = jsonDb.findRoomById(roomId);
    const memberName = roomRes ? jsonDb.findRoomByCode(roomRes.code)?.members.find((m) => m.id === memberId)?.displayName || 'Someone' : 'Someone';

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
