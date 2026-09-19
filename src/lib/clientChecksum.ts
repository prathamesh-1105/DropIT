export async function calculateSHA256(file: File): Promise<string> {
  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(`fast_${file.size}_${file.lastModified}_${Math.random().toString(36).substring(2, 8)}`);
    }, 500);
  });

  const hashComputation = (async (): Promise<string> => {
    try {
      let bufferToHash: ArrayBuffer;

      // For files > 5MB, sample 256KB from head, middle, and tail for instantaneous hash calculation
      if (file.size > 5 * 1024 * 1024) {
        const sampleSize = 256 * 1024;
        const head = await file.slice(0, sampleSize).arrayBuffer();
        const midStart = Math.floor(file.size / 2);
        const mid = await file.slice(midStart, midStart + sampleSize).arrayBuffer();
        const tail = await file.slice(Math.max(0, file.size - sampleSize)).arrayBuffer();

        const metaString = `${file.name}_${file.size}_${file.lastModified}_${file.type}`;
        const metaEncoder = new TextEncoder().encode(metaString);

        const combined = new Uint8Array(head.byteLength + mid.byteLength + tail.byteLength + metaEncoder.byteLength);
        combined.set(new Uint8Array(head), 0);
        combined.set(new Uint8Array(mid), head.byteLength);
        combined.set(new Uint8Array(tail), head.byteLength + mid.byteLength);
        combined.set(metaEncoder, head.byteLength + mid.byteLength + tail.byteLength);

        bufferToHash = combined.buffer;
      } else {
        bufferToHash = await file.arrayBuffer();
      }

      const hashBuffer = await crypto.subtle.digest('SHA-256', bufferToHash);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.error('Error calculating client checksum:', err);
      return `fallback_${file.size}_${file.lastModified}`;
    }
  })();

  return Promise.race([hashComputation, timeoutPromise]);
}

