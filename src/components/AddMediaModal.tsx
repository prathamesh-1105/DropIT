'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  Play,
  Pause,
  RotateCcw,
  FileCheck,
  ShieldCheck,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { calculateSHA256 } from '@/lib/clientChecksum';

interface UploadTask {
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
}

interface AddMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  memberId: string;
  onUploadSuccess: () => void;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for max throughput
const MAX_CONCURRENT_UPLOADS = 4; // Upload up to 4 files simultaneously
const MAX_CONCURRENT_CHUNKS = 3; // Upload up to 3 chunks simultaneously per file

export const AddMediaModal: React.FC<AddMediaModalProps> = ({
  isOpen,
  onClose,
  roomId,
  memberId,
  onUploadSuccess,
}) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef<{ [key: string]: boolean }>({});

  // Fast async queue runner
  useEffect(() => {
    if (!isOpen) return;

    const uploadingCount = tasks.filter((t) => t.status === 'uploading').length;
    if (uploadingCount < MAX_CONCURRENT_UPLOADS) {
      const pendingTasks = tasks.filter((t) => t.status === 'pending');
      const slotsAvailable = MAX_CONCURRENT_UPLOADS - uploadingCount;
      const tasksToStart = pendingTasks.slice(0, slotsAvailable);

      tasksToStart.forEach((task) => {
        processFastUpload(task);
      });
    }
  }, [tasks, isOpen]);

  // Extract dimensions and video duration on client asynchronously
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

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTasks: UploadTask[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'pending',
      speed: 'Fast Stream',
      uploadedBytes: 0,
    }));

    setTasks((prev) => [...prev, ...newTasks]);

    // Extract metadata asynchronously in background without blocking upload start
    newTasks.forEach(async (task) => {
      const meta = await extractMediaMetadata(task.file);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, ...meta } : t))
      );
    });
  };

  const processFastUpload = async (task: UploadTask) => {
    activeUploadsRef.current[task.id] = true;
    const { file, id } = task;
    const uploadId = `${roomId}_${memberId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'uploading' } : t))
    );

    const startTime = Date.now();

    try {
      // Calculate SHA-256 concurrently
      const checksumPromise = calculateSHA256(file);

      // Fast Path for files under 25MB: Direct single burst upload
      if (file.size <= 25 * 1024 * 1024) {
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', '0');
        formData.append('totalChunks', '1');
        formData.append('chunk', file);

        const chunkRes = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
        });

        if (!chunkRes.ok) throw new Error('Direct burst upload failed');

        const checksum = await checksumPromise;
        const completeRes = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            roomId,
            memberId,
            originalFilename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            checksum,
            width: task.width,
            height: task.height,
            duration: task.duration,
          }),
        });

        if (!completeRes.ok) throw new Error('Assembly failed');

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speedFormatted = elapsedSeconds > 0 ? `${formatBytes(file.size / elapsedSeconds)}/s` : 'Instant';

        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, progress: 100, status: 'completed', speed: speedFormatted }
              : t
          )
        );

        onUploadSuccess();
        return;
      }

      // Parallel Multi-Chunk Upload Path for large videos/files
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedChunksCount = 0;

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

        const res = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(`Chunk ${chunkIndex} failed`);

        uploadedChunksCount++;
        const currentBytes = Math.min(uploadedChunksCount * CHUNK_SIZE, file.size);
        const progressPercent = Math.round((currentBytes / file.size) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speedFormatted = elapsed > 0 ? `${formatBytes(currentBytes / elapsed)}/s` : 'Fast';

        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, progress: progressPercent, uploadedBytes: currentBytes, speed: speedFormatted }
              : t
          )
        );
      };

      // Execute chunks in parallel batches of MAX_CONCURRENT_CHUNKS
      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
      for (let i = 0; i < chunkIndices.length; i += MAX_CONCURRENT_CHUNKS) {
        if (!activeUploadsRef.current[id]) break;
        const batch = chunkIndices.slice(i, i + MAX_CONCURRENT_CHUNKS);
        await Promise.all(batch.map((idx) => uploadChunkIndex(idx)));
      }

      const checksum = await checksumPromise;
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          roomId,
          memberId,
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          checksum,
          width: task.width,
          height: task.height,
          duration: task.duration,
        }),
      });

      if (!completeRes.ok) throw new Error('File assembly failed');

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, progress: 100, status: 'completed', speed: 'Done' } : t
        )
      );

      onUploadSuccess();
    } catch (err: any) {
      console.error('Fast upload error:', err);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'failed', error: err.message } : t))
      );
    } finally {
      delete activeUploadsRef.current[id];
    }
  };

  const togglePauseResume = (task: UploadTask) => {
    if (task.status === 'uploading') {
      activeUploadsRef.current[task.id] = false;
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'paused' } : t))
      );
    } else if (task.status === 'paused' || task.status === 'failed') {
      processFastUpload(task);
    }
  };

  const removeTask = (id: string) => {
    activeUploadsRef.current[id] = false;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  if (!isOpen) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const isUploadingAny = tasks.some((t) => t.status === 'uploading');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col max-h-[90vh] text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span>+ Add Photos & Videos</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-blue-500" /> Ultra-Fast
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Zero compression. Parallel multi-stream byte-for-byte transfer.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelection(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
              : 'border-slate-300 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-950/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,video/*,.heic,.heif,.dng,.raw"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
          />
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Drag & drop photos & videos here, or <span className="text-blue-600 dark:text-blue-400 underline font-black">browse</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Supports HEIC, JPG, PNG, WebP, DNG, RAW, MP4, MOV, 4K & 60fps videos.
          </p>
        </div>

        {/* Queue List */}
        {tasks.length > 0 && (
          <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-64">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold px-1">
              <span>
                Queue: {completedCount} / {tasks.length} uploaded
              </span>
              {isUploadingAny && (
                <span className="text-blue-600 dark:text-blue-400 font-mono animate-pulse flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-blue-500" /> Streaming...
                </span>
              )}
            </div>

            {tasks.map((task) => {
              const isVideo = task.file.type.startsWith('video/');

              return (
                <div
                  key={task.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {isVideo ? (
                      <video src={task.previewUrl} className="w-full h-full object-cover" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={task.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    )}
                    {isVideo && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {task.file.name}
                      </span>
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-2">
                        {task.speed}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>{formatBytes(task.file.size)}</span>
                      {task.status === 'completed' ? (
                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span>{task.progress}%</span>
                      )}
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          task.status === 'completed'
                            ? 'bg-blue-600'
                            : task.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(task.status === 'uploading' || task.status === 'paused') && (
                      <button
                        onClick={() => togglePauseResume(task)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                        title={task.status === 'uploading' ? 'Pause' : 'Resume'}
                      >
                        {task.status === 'uploading' ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </button>
                    )}

                    {task.status === 'failed' && (
                      <button
                        onClick={() => processFastUpload(task)}
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                        title="Retry upload"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Integrity Verified</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            {completedCount === tasks.length && tasks.length > 0 ? 'Done' : 'Close Drawer'}
          </button>
        </div>
      </div>
    </div>
  );
};
