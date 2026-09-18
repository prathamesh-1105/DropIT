import { NextResponse } from 'next/server';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { supabaseDb } from '@/lib/supabase';
import { createSignedAccessUrl, isCloudStorageConfigured } from '@/lib/storage';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const media = await supabaseDb.findMediaById(id);

    if (!media) {
      return new NextResponse('Media not found', { status: 404 });
    }

    // Determine path to serve (previewPath first, fallback to storagePath)
    let servePath = media.previewPath || media.storagePath;

    // Check Cloud Storage path vs Local disk path
    if (
      servePath.startsWith('rooms/') ||
      (isCloudStorageConfigured() && !fs.existsSync(servePath))
    ) {
      if (isCloudStorageConfigured()) {
        const signedUrl = await createSignedAccessUrl(servePath, 3600);
        if (signedUrl) {
          return NextResponse.redirect(signedUrl, { status: 307 });
        }
      }
    }

    // Check local filesystem paths
    let localFileExists = fs.existsSync(servePath);
    if (!localFileExists && media.storagePath && fs.existsSync(media.storagePath)) {
      servePath = media.storagePath;
      localFileExists = true;
    }

    // Fallback: try resolving relative to working directory
    if (!localFileExists) {
      const resolvedPath = path.resolve(servePath);
      if (fs.existsSync(resolvedPath)) {
        servePath = resolvedPath;
        localFileExists = true;
      }
    }

    if (!localFileExists) {
      console.warn(`Preview file not found at path: ${servePath} for media id: ${id}`);
      return new NextResponse('Preview file not found', { status: 404 });
    }

    const stat = await fsPromises.stat(servePath);
    const contentType =
      servePath.endsWith('.jpg') || servePath.endsWith('.jpeg')
        ? 'image/jpeg'
        : media.mimeType || 'image/png';

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
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error serving preview media:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

