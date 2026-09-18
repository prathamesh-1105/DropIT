'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, Zap, ShieldCheck } from 'lucide-react';
import { useUpload } from '@/context/UploadContext';

interface AddMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  memberId: string | null;
  roomCode?: string;
  onUploadSuccess: () => void;
}

export const AddMediaModal: React.FC<AddMediaModalProps> = ({
  isOpen,
  onClose,
  roomId,
  memberId,
  roomCode,
  onUploadSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUploads } = useUpload();

  if (!isOpen) return null;

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0 || !memberId) return;

    startUploads(files, roomId, memberId, roomCode, onUploadSuccess);
    onClose(); // Instantly close modal like Google Drive / Google Photos!
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060606]/80 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#fff9e9]/95 dark:bg-[#0a0a0f]/95 border border-[#e7dfcd] dark:border-white/12 p-6 shadow-2xl flex flex-col text-[#060606] dark:text-white backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e7dfcd] dark:border-white/12">
          <div>
            <h2 className="font-display text-2xl text-[#060606] dark:text-white flex items-center gap-2">
              <span>+ Add Photos & Videos</span>
              <span className="px-2.5 py-0.5 rounded-full text-meta bg-[#ffda3f] text-[#060606] border border-amber-300 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-[#060606]" /> Fast Stream
              </span>
            </h2>
            <p className="font-sans text-xs text-slate-600 dark:text-slate-400 font-normal mt-0.5">
              Zero compression. Background streaming like Google Drive.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-500 hover:text-[#060606] dark:hover:text-white hover:bg-[#eee8d2] dark:hover:bg-[#111c36] transition-all"
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
          className={`mt-6 p-10 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
            isDragging
              ? 'border-[#ffda3f] bg-[#ffda3f]/10 scale-[0.99]'
              : 'border-[#e7dfcd] dark:border-white/15 hover:border-[#ffda3f] dark:hover:border-[#ffda3f] bg-[#fff9f1] dark:bg-[#0a0a0f]/40'
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
          <div className="w-14 h-14 rounded-2xl bg-[#eee8d2] dark:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 flex items-center justify-center text-[#060606] dark:text-amber-400 mb-3 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="font-sans text-sm font-bold text-[#060606] dark:text-white">
            Drag & drop photos & videos here, or <span className="text-amber-600 dark:text-amber-400 underline font-bold">browse</span>
          </p>
          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mt-2 font-normal max-w-xs">
            Files upload instantly in background while you browse.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#e7dfcd] dark:border-white/12 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-meta text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Untouched Original Quality</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#eee8d2] dark:bg-[#111c36] hover:bg-[#e2dac3] dark:hover:bg-[#182647] text-[#060606] dark:text-white font-sans text-xs font-bold transition active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
