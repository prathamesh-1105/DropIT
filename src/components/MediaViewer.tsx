'use client';

import React, { useState } from 'react';
import { MediaItemData } from './MediaGrid';
import {
  X,
  Download,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Trash2,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface MediaViewerProps {
  item: MediaItemData | null;
  items: MediaItemData[];
  onClose: () => void;
  onSelect: (item: MediaItemData) => void;
  onDeleteMedia?: (id: string) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  item,
  items,
  onClose,
  onSelect,
  onDeleteMedia,
}) => {
  const [showMetadata, setShowMetadata] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!item) return null;

  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelect(items[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onSelect(items[currentIndex + 1]);
  };

  const isVideo = item.mimeType.startsWith('video/');

  const handleCopyChecksum = () => {
    if (item.checksum) {
      navigator.clipboard.writeText(item.checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-fadeIn">
      {/* Top Header Controls */}
      <div className="absolute top-0 inset-x-0 h-16 px-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Close viewer"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
              {item.originalFilename}
            </span>
            <span className="text-xs text-blue-400 font-bold">
              Uploaded by {item.memberName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              showMetadata
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Metadata Info"
          >
            <Info className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Info</span>
          </button>

          {onDeleteMedia && (
            <button
              onClick={() => {
                if (confirm(`Delete "${item.originalFilename}" from room?`)) {
                  onDeleteMedia(item.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition"
              title="Delete this photo/video"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <a
            href={item.originalUrl}
            download={item.originalFilename}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 transition shadow-lg shadow-blue-600/30 shrink-0"
            title="Download original untouched file"
          >
            <Download className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Download</span>
            <span className="hidden sm:inline">Original</span>
          </a>
        </div>
      </div>

      {/* Main Media Display */}
      <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-12">
        {isVideo ? (
          <video
            src={item.originalUrl}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] sm:max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.originalUrl || item.previewUrl}
            alt={item.originalFilename}
            className="max-w-full max-h-[80vh] sm:max-h-[85vh] rounded-2xl shadow-2xl object-contain select-none"
          />
        )}

        {/* Previous Button */}
        {hasPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 p-2.5 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-800 transition z-20 shadow-xl"
            title="Previous item"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Next Button */}
        {hasNext && (
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-4 p-2.5 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-800 transition z-20 shadow-xl"
            title="Next item"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* Side Metadata Drawer */}
      {showMetadata && (
        <div className="absolute inset-x-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 rounded-2xl bg-slate-950/90 border border-slate-800 p-4 text-left shadow-2xl z-30 backdrop-blur-xl animate-fadeIn text-white max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Loss Media</span>
            </div>
            <button
              onClick={() => setShowMetadata(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Close
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Filename
              </span>
              <span className="text-white font-bold truncate block">
                {item.originalFilename}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  File Size
                </span>
                <span className="text-white font-mono font-bold">
                  {formatBytes(item.size)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Format
                </span>
                <span className="text-blue-400 font-mono font-black uppercase">
                  {item.mimeType.split('/')[1] || 'BINARY'}
                </span>
              </div>
            </div>

            {item.width && item.height && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Resolution
                </span>
                <span className="text-white font-mono font-bold">
                  {item.width} × {item.height}
                </span>
              </div>
            )}

            {item.duration && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  Duration
                </span>
                <span className="text-white font-mono font-bold">
                  {Math.floor(item.duration / 60)}m {Math.floor(item.duration % 60)}s
                </span>
              </div>
            )}

            {item.checksum && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  SHA-256 Checksum
                </span>
                <div
                  onClick={handleCopyChecksum}
                  className="mt-1 p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-300 cursor-pointer hover:border-slate-700 transition"
                  title="Click to copy SHA-256 hash"
                >
                  <span className="truncate mr-2">{item.checksum}</span>
                  {copiedHash ? (
                    <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <span className="text-[9px] uppercase text-blue-400 font-extrabold">Copy</span>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Original status:</span>
              <span className="text-blue-400 font-extrabold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Untouched
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
