'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { formatBytes } from '@/lib/utils';
import { calculateSHA256 } from '@/lib/clientChecksum';
import {
  requestNotificationPermission,
  sendUploadProgressNotification,
  sendUploadCompleteNotification,
} from '@/lib/notifications';
import {
  saveUploadTaskToDB,
  loadUploadTasksFromDB,
  removeUploadTaskFromDB,
  clearCompletedTasksFromDB,
} from '@/lib/uploadStorage';

export interface UploadTask {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  speed: string;
  uploadedBytes: number;
  width?: number;
  height?: number;
  duration?: number;
  error?: string;
  roomId: string;
  memberId: string;
  roomCode?: string;
}

interface UploadContextType {
  tasks: UploadTask[];
  startUploads: (
    files: FileList | File[],
    roomId: string,
    memberId: string,
    roomCode?: string,
    onSuccessCallback?: () => void
  ) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks
const MAX_CONCURRENT_UPLOADS = 12;
const MAX_CONCURRENT_CHUNKS = 8;

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const activeUploadsRef = useRef<{ [key: string]: boolean }>({});
  const lastNotifyTimeRef = useRef<number>(0);
  const callbacksRef = useRef<{ [roomId: string]: Set<() => void> }>({});

  // Restore incomplete upload tasks from IndexedDB on startup / reload
  useEffect(() => {
    const restorePersistedUploads = async () => {
      try {
        const stored = await loadUploadTasksFromDB();
        if (!stored || stored.length === 0) return;

        const restoredTasks: UploadTask[] = [];

        for (const record of stored) {
          if (record.status === 'completed') {
            await removeUploadTaskFromDB(record.id);
            continue;
          }

          const file =
            record.file instanceof File
              ? record.file
              : new File([record.file], record.filename, { type: record.mimeType });

          restoredTasks.push({
            id: record.id,
            file,
            previewUrl: URL.createObjectURL(file),
            progress: record.progress || 0,
            status: 'pending', // Re-queue incomplete uploads automatically
            speed: 'Resuming...',
            uploadedBytes: record.uploadedBytes || 0,
            width: record.width,
            height: record.height,
            duration: record.duration,
            error: record.error,
            roomId: record.roomId,
            memberId: record.memberId,
            roomCode: record.roomCode,
          });
        }

        if (restoredTasks.length > 0) {
          setTasks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newRestored = restoredTasks.filter((t) => !existingIds.has(t.id));
            return [...prev, ...newRestored];
          });
        }
      } catch (err) {
        console.warn('Error restoring persisted uploads from IndexedDB:', err);
      }
    };

    restorePersistedUploads();
  }, []);

  // Browser navigation & tab close protection (beforeunload warning)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasActive = tasks.some(
        (t) => t.status === 'uploading' || t.status === 'pending'
      );
      if (hasActive) {
        e.preventDefault();
        e.returnValue =
          'Uploads are in progress. Your uploads will automatically resume when you return, but closing now will pause active transfers.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tasks]);

  // Auto-resume uploads when window returns to focus or network reconnects
  useEffect(() => {
    const handleResumePending = () => {
      setTasks((prev) =>
        prev.map((t) =>
          t.status === 'paused' || t.status === 'failed'
            ? { ...t, status: 'pending', error: undefined, speed: 'Resuming...' }
            : t
        )
      );
    };

    window.addEventListener('online', handleResumePending);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleResumePending();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleResumePending);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const registerSuccessCallback = (roomId: string, cb?: () => void) => {
    if (!cb) return;
    if (!callbacksRef.current[roomId]) {
      callbacksRef.current[roomId] = new Set();
    }
    callbacksRef.current[roomId].add(cb);
  };

  const triggerSuccessCallbacks = (roomId: string) => {
    if (callbacksRef.current[roomId]) {
      callbacksRef.current[roomId].forEach((cb) => cb());
    }
  };

  // Process async task queue & OS desktop notifications
  useEffect(() => {
    const uploadingCount = tasks.filter((t) => t.status === 'uploading').length;
    if (uploadingCount < MAX_CONCURRENT_UPLOADS) {
      const pendingTasks = tasks.filter((t) => t.status === 'pending');
      const slotsAvailable = MAX_CONCURRENT_UPLOADS - uploadingCount;
      const tasksToStart = pendingTasks.slice(0, slotsAvailable);

      tasksToStart.forEach((task) => {
        processFastUpload(task);
      });
    }

    // Aggregate upload progress calculation
    if (tasks.length > 0) {
      const totalBytes = tasks.reduce((sum, t) => sum + t.file.size, 0);
      const uploadedBytes = tasks.reduce(
        (sum, t) => sum + (t.uploadedBytes || (t.status === 'completed' ? t.file.size : 0)),
        0
      );
      const aggregatePercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

      const now = Date.now();
      if (aggregatePercent > 0 && aggregatePercent < 100 && now - lastNotifyTimeRef.current > 2000) {
        lastNotifyTimeRef.current = now;
        sendUploadProgressNotification(aggregatePercent, tasks.length);
      } else if (aggregatePercent === 100 && tasks.length > 0 && tasks.every((t) => t.status === 'completed')) {
        sendUploadCompleteNotification(tasks.length);
        clearCompletedTasksFromDB();
      }
    }
  }, [tasks]);

  const extractMediaMetadata = (file: File): Promise<{ width?: number; height?: number; duration?: number }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => resolve({});
        img.src = url;
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
          URL.revokeObjectURL(url);
        };
        video.onerror = () => resolve({});
        video.src = url;
      } else {
        resolve({});
      }
    });
  };

  const startUploads = (
    files: FileList | File[],
    roomId: string,
    memberId: string,
    roomCode?: string,
    onSuccessCallback?: () => void
  ) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    requestNotificationPermission();
    registerSuccessCallback(roomId, onSuccessCallback);
    setIsWidgetOpen(true);

    const newTasks: UploadTask[] = fileArray.map((file) => {
      const taskId = Math.random().toString(36).substring(2, 9);
      // Persist task & file to IndexedDB for resumable persistence
      saveUploadTaskToDB({
        id: taskId,
        file,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        progress: 0,
        status: 'pending',
        uploadedBytes: 0,
        roomId,
        memberId,
        roomCode,
        createdAt: Date.now(),
      });

      return {
        id: taskId,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
        speed: 'Starting...',
        uploadedBytes: 0,
        roomId,
        memberId,
        roomCode,
      };
    });

    setTasks((prev) => [...prev, ...newTasks]);

    // Extract metadata asynchronously in background without blocking queue start
    newTasks.forEach(async (task) => {
      const meta = await extractMediaMetadata(task.file);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...meta } : t)));
      saveUploadTaskToDB({
        id: task.id,
        file: task.file,
        filename: task.file.name,
        mimeType: task.file.type || 'application/octet-stream',
        size: task.file.size,
        progress: 0,
        status: 'pending',
        uploadedBytes: 0,
        roomId: task.roomId,
        memberId: task.memberId,
        roomCode: task.roomCode,
        createdAt: Date.now(),
        ...meta,
      });
    });
  };

  const postFormDataWithProgress = (
    url: string,
    formData: FormData,
    token?: string | null,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(e.loaded, e.total);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({ ok: true });
          }
        } else {
          reject(new Error(`Upload status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      xhr.send(formData);
    });
  };

  const processFastUpload = async (task: UploadTask) => {
    activeUploadsRef.current[task.id] = true;
    const { file, id, roomId, memberId, roomCode } = task;

    // Deterministic upload ID so resumed uploads match existing server chunks seamlessly
    const sanitizeStr = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_');
    const uploadId = `${roomId}_${memberId}_${sanitizeStr(file.name)}_${file.size}`;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'uploading', speed: 'Uploading...' } : t))
    );

    const startTime = Date.now();

    try {
      const checksumPromise = calculateSHA256(file);
      const token =
        (roomCode ? localStorage.getItem(`drop_token_${roomCode}`) : null) ||
        localStorage.getItem(`drop_token_${roomId}`) ||
        null;
      const jsonHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) jsonHeaders['Authorization'] = `Bearer ${token}`;

      // Check Direct Cloud Signed Authorization
      try {
        const authRes = await fetch('/api/upload/authorize', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            roomId,
            memberId,
            token,
            originalFilename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
          }),
        });

        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.useCloud && authData.originalUploadUrl) {
            const uploadHeaders: Record<string, string> = {
              'Content-Type': file.type || 'application/octet-stream',
            };
            if (authData.originalToken) {
              uploadHeaders['Authorization'] = `Bearer ${authData.originalToken}`;
            }

            const uploadRes = await fetch(authData.originalUploadUrl, {
              method: 'PUT',
              headers: uploadHeaders,
              body: file,
            });

            if (uploadRes.ok) {
              setTasks((prev) =>
                prev.map((t) => (t.id === id ? { ...t, progress: 95, speed: 'Completing...' } : t))
              );

              const checksum = await checksumPromise;
              const completeRes = await fetch('/api/upload/complete', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                  cloud: true,
                  fileId: authData.fileId,
                  roomId,
                  memberId,
                  token,
                  originalFilename: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  size: file.size,
                  checksum,
                  width: task.width,
                  height: task.height,
                  duration: task.duration,
                  storagePath: authData.originalPath,
                  previewPath: authData.previewPath,
                }),
              });

              if (completeRes.ok) {
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const speedFormatted = elapsedSeconds > 0 ? `${formatBytes(file.size / elapsedSeconds)}/s` : 'Direct Cloud';

                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === id
                      ? { ...t, progress: 100, status: 'completed', speed: speedFormatted, uploadedBytes: file.size }
                      : t
                  )
                );

                removeUploadTaskFromDB(id);
                triggerSuccessCallbacks(roomId);
                return;
              }
            }
            console.warn('Direct cloud upload or completion failed, falling back to local chunk upload...');
          }
        }
      } catch (cloudErr) {
        console.warn('Direct cloud upload error, falling back to local chunk upload:', cloudErr);
      }

      // Fast Burst Path for files <= 25MB
      if (file.size <= 25 * 1024 * 1024) {
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', '0');
        formData.append('totalChunks', '1');
        formData.append('chunk', file);

        await postFormDataWithProgress('/api/upload/chunk', formData, token, (loaded, total) => {
          const currentProgress = Math.min(92, Math.round((loaded / total) * 92));
          const elapsed = (Date.now() - startTime) / 1000;
          const speedFormatted = elapsed > 0 ? `${formatBytes(loaded / elapsed)}/s` : 'Fast';

          setTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? { ...t, progress: currentProgress, uploadedBytes: loaded, speed: speedFormatted }
                : t
            )
          );
        });

        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress: 96, speed: 'Finalizing...' } : t))
        );

        const checksum = await checksumPromise;
        const completeRes = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            uploadId,
            roomId,
            memberId,
            token,
            originalFilename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            checksum,
            width: task.width,
            height: task.height,
            duration: task.duration,
          }),
        });

        if (!completeRes.ok) {
          const errText = await completeRes.text().catch(() => '');
          let errMsg = 'Assembly failed';
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error) errMsg = errJson.error;
          } catch (e) {}
          throw new Error(errMsg);
        }

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedFormatted = elapsedSeconds > 0 ? `${formatBytes(file.size / elapsedSeconds)}/s` : 'Done';

        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, progress: 100, status: 'completed', speed: speedFormatted, uploadedBytes: file.size }
              : t
          )
        );

        removeUploadTaskFromDB(id);
        triggerSuccessCallbacks(roomId);
        return;
      }

      // Multi-Chunk Streaming Path for large files with XHR real-time progress
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const chunkProgresses: { [key: number]: number } = {};

      const uploadChunkIndex = async (chunkIndex: number) => {
        if (!activeUploadsRef.current[id]) return;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('chunk', chunkBlob);

        await postFormDataWithProgress('/api/upload/chunk', formData, token, (loaded) => {
          chunkProgresses[chunkIndex] = loaded;
          const totalLoaded = Object.values(chunkProgresses).reduce((sum, b) => sum + b, 0);
          const currentPercent = Math.min(92, Math.round((totalLoaded / file.size) * 92));
          const elapsed = (Date.now() - startTime) / 1000;
          const speedFormatted = elapsed > 0 ? `${formatBytes(totalLoaded / elapsed)}/s` : 'Fast';

          setTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? { ...t, progress: currentPercent, uploadedBytes: totalLoaded, speed: speedFormatted }
                : t
            )
          );
        });
      };

      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
      for (let i = 0; i < chunkIndices.length; i += MAX_CONCURRENT_CHUNKS) {
        if (!activeUploadsRef.current[id]) break;
        const batch = chunkIndices.slice(i, i + MAX_CONCURRENT_CHUNKS);
        await Promise.all(batch.map((idx) => uploadChunkIndex(idx)));
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, progress: 96, speed: 'Assembling...' } : t))
      );

      const checksum = await checksumPromise;
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          uploadId,
          roomId,
          memberId,
          token,
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          checksum,
          width: task.width,
          height: task.height,
          duration: task.duration,
        }),
      });

      if (!completeRes.ok) {
        const errText = await completeRes.text().catch(() => '');
        let errMsg = 'File assembly failed';
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error) errMsg = errJson.error;
        } catch (e) {}
        throw new Error(errMsg);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, progress: 100, status: 'completed', speed: 'Done', uploadedBytes: file.size }
            : t
        )
      );

      removeUploadTaskFromDB(id);
      triggerSuccessCallbacks(roomId);
    } catch (err: any) {
      console.error('Fast upload error:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'failed', error: err.message || 'Upload failed' } : t))
      );
    } finally {
      delete activeUploadsRef.current[id];
    }
  };

  const pauseTask = (id: string) => {
    activeUploadsRef.current[id] = false;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'paused' } : t)));
  };

  const resumeTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'pending', error: undefined } : t)));
    }
  };

  const removeTask = (id: string) => {
    activeUploadsRef.current[id] = false;
    removeUploadTaskFromDB(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    clearCompletedTasksFromDB();
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  return (
    <UploadContext.Provider
      value={{
        tasks,
        startUploads,
        pauseTask,
        resumeTask,
        removeTask,
        clearCompleted,
        isWidgetOpen,
        setIsWidgetOpen,
        activeRoomId,
        setActiveRoomId,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
