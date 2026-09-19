let workerInstance: Worker | null = null;
const pendingJobs = new Map<
  string,
  { resolve: (hash: string) => void; reject: (err: any) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || !('Worker' in window)) return null;

  if (!workerInstance) {
    try {
      workerInstance = new Worker('/hashWorker.js');
      workerInstance.onmessage = (e: MessageEvent) => {
        const { id, hash } = e.data;
        const callbacks = pendingJobs.get(id);
        if (callbacks) {
          pendingJobs.delete(id);
          callbacks.resolve(hash);
        }
      };
      workerInstance.onerror = (err) => {
        console.warn('Web Worker error, falling back to main thread:', err);
        workerInstance = null;
      };
    } catch (err) {
      console.warn('Failed to initialize Web Worker, falling back to main thread:', err);
      workerInstance = null;
    }
  }

  return workerInstance;
}

export function cancelSHA256(id: string): void {
  if (pendingJobs.has(id)) {
    pendingJobs.delete(id);
  }
}

export async function calculateSHA256(file: File, taskId?: string): Promise<string> {
  const jobId = taskId || Math.random().toString(36).substring(2, 9);

  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(`fast_${file.size}_${file.lastModified}_${Math.random().toString(36).substring(2, 8)}`);
    }, 1500);
  });

  const worker = getWorker();
  let hashPromise: Promise<string>;

  if (worker) {
    hashPromise = new Promise<string>((resolve, reject) => {
      pendingJobs.set(jobId, { resolve, reject });
      worker.postMessage({ id: jobId, file });
    });
  } else {
    // Inline Main-Thread Fallback if Worker unavailable
    hashPromise = (async (): Promise<string> => {
      try {
        let bufferToHash: ArrayBuffer;
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
  }

  return Promise.race([hashPromise, timeoutPromise]);
}

