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

    if (!media || !fs.existsSync(media.storagePath)) {
      return new NextResponse('Media file not found', { status: 404 });
    }

    const stat = await fsPromises.stat(media.storagePath);
    const fileSize = stat.size;

    const range = req.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const nodeStream = fs.createReadStream(media.storagePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': media.mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(media.originalFilename)}"`,
        },
      });
    }

    const nodeStream = fs.createReadStream(media.storagePath);
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
        'Content-Type': media.mimeType || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(media.originalFilename)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving original media:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
