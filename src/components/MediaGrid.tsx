'use client';

import React from 'react';
import { Play, Check, ShieldCheck, Image as ImageIcon, Trash2, Zap, AlertCircle } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { UploadTask } from '@/context/UploadContext';

export interface MediaItemData {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  checksum: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
  memberId: string;
  memberName: string;
  previewUrl: string;
  originalUrl: string;
}

interface MediaGridProps {
  items: MediaItemData[];
  optimisticTasks?: UploadTask[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenViewer: (item: MediaItemData) => void;
  onDeleteMedia?: (id: string) => void;
  isSelecting: boolean;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  optimisticTasks = [],
  selectedIds,
  onToggleSelect,
  onOpenViewer,
  onDeleteMedia,
  isSelecting,
}) => {
  // Deduplicate tasks: keep optimistic preview visible until saved server items contain the file
  const savedItemKeys = new Set(items.map((i) => `${i.originalFilename}_${i.size}`));
  const activeOptimisticTasks = optimisticTasks.filter(
    (t) => !savedItemKeys.has(`${t.file.name}_${t.file.size}`) && t.status !== 'failed'
  );
  const hasContent = items.length > 0 || activeOptimisticTasks.length > 0;

  if (!hasContent) {
    return (
      <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center rounded-3xl glass-card border border-dashed border-[#e7dfcd] dark:border-white/15">
        <div className="w-14 h-14 rounded-2xl bg-[#eee8d2] dark:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 flex items-center justify-center text-[#060606] dark:text-amber-400 mb-4 shadow-inner">
          <ImageIcon className="w-7 h-7" />
        </div>
        <h3 className="font-display text-2xl text-[#060606] dark:text-white mb-1">No memories uploaded yet</h3>
        <p className="font-sans text-xs text-slate-600 dark:text-slate-400 max-w-sm">
          Tap <span className="text-amber-600 dark:text-amber-400 font-bold">+ Add Memories</span> above or drag & drop original photos and videos anywhere on screen.
        </p>
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFormatBadge = (filename: string, mimeType: string) => {
    const ext = filename.split('.').pop()?.toUpperCase() || '';
    if (['HEIC', 'HEIF', 'DNG', 'RAW', 'NEF', 'CR2'].includes(ext)) {
      return ext;
    }
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return ext;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
      {/* Optimistic Uploading Grid Items (Crisp visible preview cover & progress indicator) */}
      {activeOptimisticTasks.map((task) => {
        const isVideo = task.file.type.startsWith('video/');
        const formatExt = getFormatBadge(task.file.name, task.file.type);
        const progressPercent = Math.max(0, Math.min(100, task.progress));
        const progressFraction = progressPercent / 100;

        // Bright, crisp preview image style so the photo cover is 100% clear and recognizable
        const imageStyle: React.CSSProperties = {
          opacity: 0.88 + progressFraction * 0.12,
          filter: 'none',
          transition: 'opacity 0.2s ease',
        };

        return (
          <div
            key={`upload_${task.id}`}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-[#0a0a0f] border border-[#ffda3f]/80 ring-2 ring-[#ffda3f]/40 shadow-xl select-none"
          >
            {/* Live Blob Thumbnail Preview (Crisp & 100% Recognizable) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={task.previewUrl}
              alt={task.file.name}
              style={imageStyle}
              className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-300"
            />

            {/* Subtle Gradient Overlays for readable text without obscuring photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

            {/* Top Format Badge & Status */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-[#ffda3f] text-[#060606] shadow-md flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 fill-[#060606]" /> {formatExt}
              </span>

              {/* Compact Glass Percentage Pill */}
              <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold bg-black/75 text-[#ffda3f] border border-[#ffda3f]/50 backdrop-blur-md shadow-md">
                {task.status === 'failed' ? 'Failed' : `${progressPercent}%`}
              </span>
            </div>

            {/* Center Play Icon for Video Previews */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xl">
                  <Play className="w-4 h-4 fill-white translate-x-0.5" />
                </div>
              </div>
            )}

            {/* Bottom Info & Live Speed Indicator */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 flex flex-col justify-end pointer-events-none">
              <div className="flex items-center justify-between text-[11px] text-white font-bold font-sans">
                <span className="truncate max-w-[70%]" title={task.file.name}>
                  {task.file.name}
                </span>
                <span className="font-mono text-[10px] text-amber-300 font-bold shrink-0">
                  {task.status === 'failed'
                    ? 'Failed'
                    : progressPercent >= 95
                    ? 'Finalizing'
                    : task.speed}
                </span>
              </div>
            </div>

            {/* Bottom Live Progress Bar */}
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
              <div
                className={`h-full transition-all duration-150 ${
                  task.status === 'failed' ? 'bg-rose-500' : 'bg-[#ffda3f]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Actual Saved Database Media Items */}
      {items.map((item) => {
        const isSelected = selectedIds.has(item.id);
        const isVideo = item.mimeType.startsWith('video/');
        const formatExt = getFormatBadge(item.originalFilename, item.mimeType);

        return (
          <div
            key={item.id}
            onClick={() => {
              if (isSelecting) {
                onToggleSelect(item.id);
              } else {
                onOpenViewer(item);
              }
            }}
            className={`group relative aspect-square rounded-2xl overflow-hidden bg-[#0a0a0f] border cursor-pointer select-none transition-all duration-200 ${
              isSelected
                ? 'border-[#ffda3f] ring-2 ring-[#ffda3f]/60 shadow-xl shadow-amber-500/20'
                : 'border-[#e7dfcd] dark:border-white/12 hover:border-[#ffda3f]/60 hover:shadow-lg'
            }`}
          >
            {/* Thumbnail Preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt={item.originalFilename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />

            {/* Video overlay play icon */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/20 transition-colors">
                <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-white translate-x-0.5" />
                </div>
              </div>
            )}

            {/* Top gradient & badges */}
            <div className="absolute top-0 inset-x-0 p-2 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none">
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/20 backdrop-blur-md">
                {formatExt}
              </span>

              {onDeleteMedia && !isSelecting ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${item.originalFilename}" from room?`)) {
                      onDeleteMedia(item.id);
                    }
                  }}
                  className="pointer-events-auto p-1.5 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow-md transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                  title="Delete photo/video"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : (
                <span
                  className="p-1.5 rounded-full bg-[#ffda3f] text-[#060606] backdrop-blur-md border border-amber-300 shadow-xs"
                  title="Byte-for-byte Original Zero-Loss File"
                >
                  <ShieldCheck className="w-3 h-3" />
                </span>
              )}
            </div>

            {/* Selection checkbox */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(item.id);
              }}
              className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10 ${
                isSelected
                  ? 'bg-[#ffda3f] text-[#060606] shadow-md scale-100'
                  : 'bg-black/40 hover:bg-black/70 text-white border border-white/30 opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              } ${isSelecting ? 'opacity-100 scale-100' : ''}`}
            >
              <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'block' : 'hidden'}`} />
            </div>

            {/* Bottom info gradient overlay */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pointer-events-none">
              <div className="flex items-center justify-between text-[11px] text-white font-bold font-sans">
                <span className="truncate max-w-[70%]" title={item.originalFilename}>
                  {item.originalFilename}
                </span>
                <span className="font-mono text-[10px] text-slate-300 shrink-0">
                  {formatBytes(item.size)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-300 mt-0.5">
                <span className="text-[#ffda3f] font-sans font-bold truncate">
                  {item.memberName}
                </span>
                {isVideo && item.duration && (
                  <span className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    {formatDuration(item.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
