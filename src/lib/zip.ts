import JSZip from 'jszip';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export interface ZipMediaItem {
  id: string;
  originalFilename: string;
  storagePath: string;
  memberName: string;
}

export async function createZeroLossZipBuffer(
  roomName: string,
  mediaItems: ZipMediaItem[]
): Promise<Buffer> {
  const zip = new JSZip();
  const rootFolderName = roomName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Media_Room';
  const rootFolder = zip.folder(rootFolderName);

  for (const item of mediaItems) {
    if (fsSync.existsSync(item.storagePath)) {
      const fileBuffer = await fs.readFile(item.storagePath);
      const memberFolderName = item.memberName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Unknown';
      const fileInFolder = rootFolder?.folder(memberFolderName);
      
      // Prevent duplicate file collisions inside the zip
      let filename = item.originalFilename;
      if (fileInFolder && fileInFolder.file(filename)) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        filename = `${base}_${item.id.slice(0, 4)}${ext}`;
      }

      if (fileInFolder) {
        fileInFolder.file(filename, fileBuffer, { binary: true });
      } else if (rootFolder) {
        rootFolder.file(`${memberFolderName}/${filename}`, fileBuffer, { binary: true });
      }
    }
  }

  const zipContent = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE', // STORE guarantees ZERO re-compression or alteration
  });

  return zipContent;
}
