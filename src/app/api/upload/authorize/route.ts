import { NextResponse } from 'next/server';
import {
  isCloudStorageConfigured,
  getCloudOriginalPath,
  getCloudPreviewPath,
  createSignedUploadUrl,
} from '@/lib/storage';
import { verifyRoomMember } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'upload_auth', 50, 60000);
  if (!rl.success) return rl.response!;

  try {
    const body = await req.json();
    const { roomId, memberId, originalFilename, mimeType, size, token: bodyToken } = body;

    if (!roomId || !memberId || !originalFilename) {
      return NextResponse.json(
        { error: 'Missing authorization parameters' },
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

    const fileId = Math.random().toString(36).substring(2, 11);
    const useCloud = isCloudStorageConfigured();

    if (!useCloud) {
      return NextResponse.json({
        useCloud: false,
        fileId,
      });
    }

    const originalPath = getCloudOriginalPath(auth.room!.id, fileId, originalFilename);
    const previewPath = getCloudPreviewPath(auth.room!.id, fileId);

    const originalSigned = await createSignedUploadUrl(originalPath);
    const previewSigned = await createSignedUploadUrl(previewPath);

    if (!originalSigned) {
      return NextResponse.json({
        useCloud: false,
        fileId,
      });
    }

    return NextResponse.json({
      useCloud: true,
      fileId,
      originalPath,
      previewPath,
      originalUploadUrl: originalSigned.signedUrl,
      originalToken: originalSigned.token,
      previewUploadUrl: previewSigned?.signedUrl || null,
      previewToken: previewSigned?.token || null,
    });
  } catch (err: any) {
    console.error('Error generating upload authorization:', err);
    return NextResponse.json(
      { error: 'Failed to authorize upload' },
      { status: 500 }
    );
  }
}

