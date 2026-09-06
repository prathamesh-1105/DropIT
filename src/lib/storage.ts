import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

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

export async function ensureDir(dirPath: string) {
  if (!fsSync.existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export function getOriginalFilePath(roomId: string, memberId: string, fileId: string, filename: string): string {
  const sanitizeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const roomDir = path.join(ORIGINALS_DIR, roomId, memberId);
  if (!fsSync.existsSync(roomDir)) {
    fsSync.mkdirSync(roomDir, { recursive: true });
  }
  return path.join(roomDir, `${fileId}_${sanitizeFilename}`);
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
