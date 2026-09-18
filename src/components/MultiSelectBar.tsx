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
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-lg w-full bg-[#fff9e9]/95 dark:bg-[#0a0a0f]/95 border border-[#e7dfcd] dark:border-white/12 p-3.5 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center justify-between animate-slideUp text-[#060606] dark:text-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-xl text-slate-400 hover:text-[#060606] dark:hover:text-white hover:bg-[#eee8d2] dark:hover:bg-[#111c36] transition-all"
          title="Clear selection"
        >
          <X className="w-5 h-5" />
        </button>

        <button
          onClick={onSelectAllToggle}
          className="flex items-center gap-1.5 text-xs font-sans text-slate-700 dark:text-slate-300 hover:text-[#060606] dark:hover:text-white transition font-bold"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
          <span>Select All</span>
        </button>

        <div className="h-4 w-px bg-[#e7dfcd] dark:bg-white/12" />

        <div className="flex flex-col">
          <span className="text-xs font-sans font-bold">
            {selectedCount} selected
          </span>
          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">
            {formatBytes(totalBytes)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-sans font-bold flex items-center gap-1.5 transition-all active:scale-95"
            title="Delete selected media items"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        <button
          onClick={onDownloadSelected}
          disabled={selectedCount === 0}
          className="px-4 py-2 rounded-xl bg-[#ffda3f] hover:bg-[#e6c335] disabled:opacity-50 text-[#060606] text-xs font-sans font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/15 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};

