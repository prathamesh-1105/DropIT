import { NextResponse } from 'next/server';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { supabaseDb } from '@/lib/supabase';
import { createSignedAccessUrl, isCloudStorageConfigured } from '@/lib/storage';
import { verifyRoomMember } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const media = await supabaseDb.findMediaById(id);

    if (!media) {
      return new NextResponse('Media record not found', { status: 404 });
    }

    const auth = await verifyRoomMember(req, media.roomId);
    if (!auth.authenticated) {
      return new NextResponse('Access denied', { status: 401 });
    }

    let servePath = media.storagePath;

    // Cloud Storage signed access URL path
    if (servePath.startsWith('rooms/') || (isCloudStorageConfigured() && !fs.existsSync(servePath))) {
      const signedUrl = await createSignedAccessUrl(servePath, 3600);
      if (signedUrl) {
        return NextResponse.redirect(signedUrl, { status: 307 });
      }
    }

    // Local Filesystem Fallback
    let localFileExists = fs.existsSync(servePath);
    if (!localFileExists) {
      const resolved = require('path').resolve(servePath);
      if (fs.existsSync(resolved)) {
        servePath = resolved;
        localFileExists = true;
      }
    }

    if (!localFileExists) {
      return new NextResponse('Media file not found on server', { status: 404 });
    }

    const stat = await fsPromises.stat(servePath);
    const fileSize = stat.size;

    const range = req.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const nodeStream = fs.createReadStream(servePath, { start, end });
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

