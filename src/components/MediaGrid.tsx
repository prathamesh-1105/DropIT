'use client';

import React from 'react';
import { Play, Check, ShieldCheck, Image as ImageIcon, Trash2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

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
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenViewer: (item: MediaItemData) => void;
  onDeleteMedia?: (id: string) => void;
  isSelecting: boolean;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onOpenViewer,
  onDeleteMedia,
  isSelecting,
}) => {
  if (items.length === 0) {
    return (
      <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
          <ImageIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">No media items yet</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Click <span className="text-blue-600 dark:text-blue-400 font-bold">+ Add</span> above or drag & drop original photos and videos anywhere on screen.
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
            className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border cursor-pointer select-none transition-all duration-200 ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-500/60 shadow-xl shadow-blue-500/20'
                : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg'
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-black/60 text-white border border-white/20 backdrop-blur-md">
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
                  className="pointer-events-auto p-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow-md transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                  title="Delete photo/video"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : (
                <span
                  className="p-1 rounded-full bg-blue-600/80 text-white backdrop-blur-md border border-blue-400/40 shadow-sm"
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
                  ? 'bg-blue-600 text-white shadow-md scale-100'
                  : 'bg-black/40 hover:bg-black/70 text-white border border-white/30 opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
              } ${isSelecting ? 'opacity-100 scale-100' : ''}`}
            >
              <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'block' : 'hidden'}`} />
            </div>

            {/* Bottom info gradient overlay */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pointer-events-none">
              <div className="flex items-center justify-between text-[11px] text-white font-bold">
                <span className="truncate max-w-[70%]" title={item.originalFilename}>
                  {item.originalFilename}
                </span>
                <span className="font-mono text-[10px] text-slate-300 shrink-0">
                  {formatBytes(item.size)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-300 mt-0.5">
                <span className="text-blue-400 font-bold truncate">
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
