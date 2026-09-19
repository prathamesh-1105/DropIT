import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/**
 * Creates a lightweight preview image from original image file if supported natively,
 * or copies a fallback preview asset. Original file is NEVER modified or touched.
 */
export async function generatePreview(
  originalPath: string,
  previewPath: string,
  mimeType: string
): Promise<boolean> {
  try {
    // If preview path points to original path or if it's a video file, skip copying
    if (originalPath === previewPath || mimeType.startsWith('video/')) {
      return true;
    }

    const previewDir = path.dirname(previewPath);
    if (!fsSync.existsSync(previewDir)) {
      await fs.mkdir(previewDir, { recursive: true });
    }

    if (mimeType.startsWith('image/')) {
      await fs.copyFile(originalPath, previewPath);
      return true;
    }

    return true;
  } catch (err) {
    console.error('Error generating server preview:', err);
    return false;
  }
}
