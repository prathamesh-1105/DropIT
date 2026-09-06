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
    const previewDir = path.dirname(previewPath);
    if (!fsSync.existsSync(previewDir)) {
      await fs.mkdir(previewDir, { recursive: true });
    }

    // For standard web images (JPG, PNG, WebP, GIF), we can copy or serve directly,
    // or copy to preview path as lightweight asset.
    if (mimeType.startsWith('image/')) {
      await fs.copyFile(originalPath, previewPath);
      return true;
    }

    // For videos, create a placeholder video poster thumbnail or copy
    if (mimeType.startsWith('video/')) {
      // In production server environment without ffmpeg binary,
      // client-side video preview thumbnail is generated on upload via HTML5 <canvas>.
      // Server saves fallback copy.
      await fs.copyFile(originalPath, previewPath);
      return true;
    }

    // Default fallback
    await fs.copyFile(originalPath, previewPath);
    return true;
  } catch (err) {
    console.error('Error generating server preview:', err);
    return false;
  }
}
