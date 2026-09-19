import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import { getChunkFilePath } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const queryUploadId = url.searchParams.get('uploadId');
    const queryChunkIndex = url.searchParams.get('chunkIndex');
    const contentType = req.headers.get('content-type') || '';

    let uploadId: string | null = null;
    let chunkIndexStr: string | null = null;
    let buffer: Buffer;

    if (
      queryUploadId &&
      queryChunkIndex !== null &&
      (contentType.includes('application/octet-stream') || !contentType.includes('multipart/form-data'))
    ) {
      uploadId = queryUploadId;
      chunkIndexStr = queryChunkIndex;
      const arrayBuf = await req.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      const formData = await req.formData();
      uploadId = formData.get('uploadId') as string;
      chunkIndexStr = formData.get('chunkIndex') as string;
      const chunkBlob = formData.get('chunk') as Blob;

      if (!chunkBlob) {
        return NextResponse.json(
          { error: 'Missing chunk blob' },
          { status: 400 }
        );
      }
      buffer = Buffer.from(await chunkBlob.arrayBuffer());
    }

    if (!uploadId || chunkIndexStr === null || buffer.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty chunk upload parameters' },
        { status: 400 }
      );
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const chunkFilePath = getChunkFilePath(uploadId, chunkIndex);

    // Fast Resume: if chunk file already exists on server disk with valid size, skip writing
    if (fsSync.existsSync(chunkFilePath)) {
      const stat = await fs.stat(chunkFilePath);
      if (stat.size > 0 && stat.size === buffer.length) {
        return NextResponse.json({
          success: true,
          chunkIndex,
          skipped: true,
        });
      }
    }

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
