import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qikbkbhskjhxqpazbwpr.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'dropit-media';

export function isCloudStorageConfigured(): boolean {
  return Boolean(
    supabaseKey &&
      supabaseKey !== 'your_supabase_anon_key_here' &&
      supabaseKey !== 'your_supabase_service_role_key_here'
  );
}

function getWritableUploadsDir(): string {
  const localDir = path.join(process.cwd(), 'uploads');
  try {
    if (!fsSync.existsSync(localDir)) {
      fsSync.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.write_test_${Math.random().toString(36).substring(2, 6)}`);
    fsSync.writeFileSync(testFile, '1');
    fsSync.unlinkSync(testFile);
    return localDir;
  } catch (err) {
    const tmpDir = path.join(os.tmpdir(), 'dropit_app', 'uploads');
    if (!fsSync.existsSync(tmpDir)) {
      fsSync.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const UPLOAD_BASE_DIR = getWritableUploadsDir();
const ORIGINALS_DIR = path.join(UPLOAD_BASE_DIR, 'originals');
const PREVIEWS_DIR = path.join(UPLOAD_BASE_DIR, 'previews');
const CHUNKS_DIR = path.join(UPLOAD_BASE_DIR, 'chunks');

// Ensure base directories exist synchronously on start
[UPLOAD_BASE_DIR, ORIGINALS_DIR, PREVIEWS_DIR, CHUNKS_DIR].forEach((dir) => {
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
});

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function getCloudOriginalPath(roomId: string, fileId: string, filename: string): string {
  return `rooms/${roomId}/originals/${fileId}/${sanitizeFilename(filename)}`;
}

export function getCloudPreviewPath(roomId: string, fileId: string): string {
  return `rooms/${roomId}/previews/${fileId}.jpg`;
}

export async function createSignedUploadUrl(
  cloudPath: string
): Promise<{ signedUrl: string; token: string; path: string } | null> {
  if (!isCloudStorageConfigured()) return null;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(cloudPath);

    if (error || !data) {
      console.error('Error creating signed upload URL:', error);
      return null;
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
  } catch (err) {
    console.error('Failed to generate signed upload URL:', err);
    return null;
  }
}

export async function createSignedAccessUrl(
  cloudPath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!isCloudStorageConfigured()) return null;

  try {
    const cleanPath = cloudPath.replace(/^dropit-media\//, '');
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error || !data) {
      console.error('Error creating signed access URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Failed to generate signed access URL:', err);
    return null;
  }
}

export async function uploadBufferToCloud(
  cloudPath: string,
  buffer: Buffer,
  mimeType: string
): Promise<boolean> {
  if (!isCloudStorageConfigured()) return false;

  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(cloudPath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Error uploading buffer to cloud:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed uploading to cloud storage:', err);
    return false;
  }
}

export async function downloadFileBuffer(storagePath: string): Promise<Buffer | null> {
  if (!storagePath) return null;

  if (storagePath.startsWith('rooms/') || !storagePath.includes(path.sep)) {
    if (!isCloudStorageConfigured()) return null;
    try {
      const cleanPath = storagePath.replace(/^dropit-media\//, '');
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(cleanPath);

      if (error || !data) {
        console.error('Error downloading cloud file buffer:', error);
        return null;
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error('Error reading cloud file buffer:', err);
      return null;
    }
  }

  try {
    if (fsSync.existsSync(storagePath)) {
      return await fs.readFile(storagePath);
    }
  } catch (err) {
    console.error('Error reading local file buffer:', err);
  }

  return null;
}

export async function deleteStorageObjects(storagePaths: (string | undefined | null)[]): Promise<void> {
  const validPaths = storagePaths.filter((p): p is string => Boolean(p && p.trim()));
  const cloudPaths: string[] = [];
  const localPaths: string[] = [];

  for (const p of validPaths) {
    if (p.startsWith('rooms/') || !p.includes(path.sep)) {
      cloudPaths.push(p.replace(/^dropit-media\//, ''));
    } else {
      localPaths.push(p);
    }
  }

  if (cloudPaths.length > 0 && isCloudStorageConfigured()) {
    try {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(cloudPaths);
    } catch (err) {
      console.error('Error deleting cloud objects:', err);
    }
  }

  for (const localPath of localPaths) {
    try {
      if (fsSync.existsSync(localPath)) {
        await fs.unlink(localPath).catch(() => {});
      }
    } catch (err) {
      console.error('Error unlinking local file:', err);
    }
  }
}

export function getOriginalFilePath(roomId: string, memberId: string, fileId: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const roomDir = path.join(ORIGINALS_DIR, roomId, memberId);
  if (!fsSync.existsSync(roomDir)) {
    fsSync.mkdirSync(roomDir, { recursive: true });
  }
  return path.join(roomDir, `${fileId}_${sanitized}`);
}

export function getPreviewFilePath(roomId: string, fileId: string): string {
  const roomPreviewDir = path.join(PREVIEWS_DIR, roomId);
  if (!fsSync.existsSync(roomPreviewDir)) {
    fsSync.mkdirSync(roomPreviewDir, { recursive: true });
  }
  return path.join(roomPreviewDir, `${fileId}.jpg`);
}

export function getChunkFilePath(uploadId: string, chunkIndex: number): string {
  const uploadChunkDir = path.join(CHUNKS_DIR, uploadId);
  if (!fsSync.existsSync(uploadChunkDir)) {
    fsSync.mkdirSync(uploadChunkDir, { recursive: true });
  }
  return path.join(uploadChunkDir, `chunk_${chunkIndex}`);
}

export async function clearChunks(uploadId: string): Promise<void> {
  const uploadChunkDir = path.join(CHUNKS_DIR, uploadId);
  try {
    if (fsSync.existsSync(uploadChunkDir)) {
      await fs.rm(uploadChunkDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error clearing chunks:', err);
  }
}

export function formatBytes(bytes: number | bigint): string {
  const numBytes = Number(bytes);
  if (numBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return `${parseFloat((numBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

