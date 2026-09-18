// Client-side IndexedDB storage utility for persistent resumable uploads

export interface StoredTaskRecord {
  id: string;
  file: Blob;
  filename: string;
  mimeType: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  uploadedBytes: number;
  width?: number;
  height?: number;
  duration?: number;
  error?: string;
  roomId: string;
  memberId: string;
  roomCode?: string;
  createdAt: number;
}

const DB_NAME = 'DropitUploadDB';
const DB_VERSION = 1;
const STORE_NAME = 'upload_tasks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('Error opening IndexedDB for uploads:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db: IDBDatabase = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveUploadTaskToDB(record: StoredTaskRecord): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save upload task to IndexedDB:', err);
  }
}

export async function loadUploadTasksFromDB(roomId?: string): Promise<StoredTaskRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        let results: StoredTaskRecord[] = request.result || [];
        if (roomId) {
          results = results.filter((r) => r.roomId === roomId);
        }
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load upload tasks from IndexedDB:', err);
    return [];
  }
}

export async function removeUploadTaskFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to remove upload task from IndexedDB:', err);
  }
}

export async function clearCompletedTasksFromDB(): Promise<void> {
  try {
    const tasks = await loadUploadTasksFromDB();
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    for (const t of completedTasks) {
      await removeUploadTaskFromDB(t.id);
    }
  } catch (err) {
    console.warn('Failed to clear completed tasks from IndexedDB:', err);
  }
}
