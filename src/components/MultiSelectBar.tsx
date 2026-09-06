'use client';

import React from 'react';
import { Download, X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface MultiSelectBarProps {
  selectedCount: number;
  totalBytes: number;
  onClearSelection: () => void;
  onDownloadSelected: () => void;
  onDownloadAll: () => void;
  onSelectAllToggle: () => void;
  onDeleteSelected?: () => void;
  isAllSelected: boolean;
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({
  selectedCount,
  totalBytes,
  onClearSelection,
  onDownloadSelected,
  onDownloadAll,
  onSelectAllToggle,
  onDeleteSelected,
  isAllSelected,
}) => {
  return (
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-lg w-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center justify-between animate-slideUp text-slate-900 dark:text-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Clear selection"
        >
          <X className="w-5 h-5" />
        </button>

        <button
          onClick={onSelectAllToggle}
          className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition font-bold"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
          <span>Select All</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex flex-col">
          <span className="text-xs font-black">
            {selectedCount} selected
          </span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">
            {formatBytes(totalBytes)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition"
            title="Delete selected media items"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        <button
          onClick={onDownloadSelected}
          disabled={selectedCount === 0}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-blue-500/20"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};
