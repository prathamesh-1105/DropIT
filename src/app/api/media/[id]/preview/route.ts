import { NextResponse } from 'next/server';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { jsonDb } from '@/lib/jsonDb';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const media = jsonDb.findMediaById(id);

    if (!media) {
      return new NextResponse('Media not found', { status: 404 });
    }

    const servePath = media.previewPath && fs.existsSync(media.previewPath)
      ? media.previewPath
      : media.storagePath;

    if (!fs.existsSync(servePath)) {
      return new NextResponse('Preview file not found', { status: 404 });
    }

    const stat = await fsPromises.stat(servePath);
    const nodeStream = fs.createReadStream(servePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': media.previewPath ? 'image/jpeg' : media.mimeType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('Error serving preview media:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
