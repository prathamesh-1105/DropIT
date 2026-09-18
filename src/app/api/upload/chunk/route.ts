import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import { getChunkFilePath } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndexStr = formData.get('chunkIndex') as string;
    const chunkBlob = formData.get('chunk') as Blob;

    if (!uploadId || chunkIndexStr === null || !chunkBlob) {
      return NextResponse.json(
        { error: 'Missing chunk upload parameters' },
        { status: 400 }
      );
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const chunkFilePath = getChunkFilePath(uploadId, chunkIndex);

    // Fast Resume: if chunk file already exists on server disk, skip writing
    if (fsSync.existsSync(chunkFilePath)) {
      const stat = await fs.stat(chunkFilePath);
      if (stat.size > 0) {
        return NextResponse.json({
          success: true,
          chunkIndex,
          skipped: true,
        });
      }
    }

    const buffer = Buffer.from(await chunkBlob.arrayBuffer());
    await fs.writeFile(chunkFilePath, buffer);

    return NextResponse.json({
      success: true,
      chunkIndex,
    });
  } catch (err: any) {
    console.error('Error saving chunk:', err);
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
      { status: 500 }
    );
  }
}
