import crypto from 'crypto';
import fs from 'fs';

export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

export function verifyChecksum(hash1: string, hash2: string): boolean {
  if (!hash1 || !hash2) return true; // If client didn't supply, skip strict match
  return hash1.toLowerCase().trim() === hash2.toLowerCase().trim();
}
