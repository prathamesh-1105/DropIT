'use client';

import React from 'react';
import { UserPlus, UploadCloud, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'join' | 'upload' | 'info';
}

interface ToastFeedProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastFeed: React.FC<ToastFeedProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl flex items-center gap-3 text-xs text-slate-900 dark:text-slate-100 animate-slideLeft font-semibold"
        >
          {toast.type === 'join' && (
            <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'upload' && (
            <div className="w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'info' && (
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </div>
          )}

          <span className="font-bold flex-1">{toast.text}</span>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 font-bold"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
