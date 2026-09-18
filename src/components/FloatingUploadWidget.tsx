'use client';

import React, { useState } from 'react';
import {
  Zap,
  ChevronUp,
  ChevronDown,
  X,
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useUpload } from '@/context/UploadContext';
import { formatBytes } from '@/lib/utils';

export const FloatingUploadWidget: React.FC = () => {
  const { tasks, pauseTask, resumeTask, removeTask, clearCompleted, isWidgetOpen, setIsWidgetOpen } =
    useUpload();

  const [isMinimized, setIsMinimized] = useState(false);

  if (tasks.length === 0 || !isWidgetOpen) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const isUploadingAny = tasks.some((t) => t.status === 'uploading' || t.status === 'pending');
  const allCompleted = completedCount === tasks.length;

  const totalBytes = tasks.reduce((sum, t) => sum + t.file.size, 0);
  const uploadedBytes = tasks.reduce(
    (sum, t) => sum + (t.uploadedBytes || (t.status === 'completed' ? t.file.size : 0)),
    0
  );
  const aggregatePercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-sm w-[calc(100vw-2.5rem)] sm:w-96 animate-fadeIn shadow-2xl transition-all">
      {/* Minimized Floating Pill Mode */}
      {isMinimized ? (
        <div
          onClick={() => setIsMinimized(false)}
          className="p-3.5 rounded-3xl bg-[#fff9e9]/95 dark:bg-[#0a0a0f]/95 border border-[#e7dfcd] dark:border-white/15 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 cursor-pointer hover:scale-[1.02] transition-transform text-[#060606] dark:text-white"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 rounded-2xl bg-[#ffda3f] text-[#060606] flex items-center justify-center shrink-0 shadow-md">
              {allCompleted ? (
                <CheckCircle className="w-5 h-5 text-[#060606]" />
              ) : (
                <Zap className="w-5 h-5 fill-[#060606] animate-pulse" />
              )}
              {/* Circular progress ring overlay */}
              {!allCompleted && (
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                  <path
                    className="text-amber-900/20"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#060606]"
                    strokeDasharray={`${aggregatePercent}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="font-sans text-xs font-bold truncate">
                {allCompleted
                  ? `${completedCount} ${completedCount === 1 ? 'upload' : 'uploads'} complete`
                  : `Uploading ${tasks.length - completedCount} of ${tasks.length} items`}
              </div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {allCompleted ? 'All memories saved' : `${aggregatePercent}% • ${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="p-1.5 rounded-xl hover:bg-[#eee8d2] dark:hover:bg-[#111c36] text-slate-500 hover:text-[#060606] dark:hover:text-white transition"
              title="Expand upload manager"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsWidgetOpen(false);
              }}
              className="p-1.5 rounded-xl hover:bg-[#eee8d2] dark:hover:bg-[#111c36] text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Full Expanded Drawer Mode (Google Drive Style) */
        <div className="rounded-3xl bg-[#fff9e9]/95 dark:bg-[#0a0a0f]/95 border border-[#e7dfcd] dark:border-white/15 backdrop-blur-2xl p-4 shadow-2xl flex flex-col text-[#060606] dark:text-white max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e7dfcd] dark:border-white/12">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#ffda3f] text-[#060606] flex items-center justify-center shadow-xs">
                {allCompleted ? <CheckCircle className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-[#060606]" />}
              </div>
              <div>
                <h4 className="font-display text-base font-bold">
                  {allCompleted ? 'Uploads Completed' : 'Uploading Memories...'}
                </h4>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {completedCount} of {tasks.length} uploaded ({aggregatePercent}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-xl hover:bg-[#eee8d2] dark:hover:bg-[#111c36] text-slate-500 hover:text-[#060606] dark:hover:text-white transition"
                title="Minimize drawer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsWidgetOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[#eee8d2] dark:hover:bg-[#111c36] text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Aggregate Progress Bar */}
          <div className="w-full bg-[#eee8d2] dark:bg-[#111c36] h-1.5 rounded-full overflow-hidden my-3">
            <div
              className="h-full bg-[#ffda3f] transition-all duration-300"
              style={{ width: `${aggregatePercent}%` }}
            />
          </div>

          {/* Item Task List */}
          <div className="overflow-y-auto space-y-2 max-h-56 pr-1">
            {tasks.map((task) => {
              const isVideo = task.file.type.startsWith('video/');

              return (
                <div
                  key={task.id}
                  className="p-2.5 rounded-2xl bg-[#fff9f1] dark:bg-[#111c36]/40 border border-[#e7dfcd] dark:border-white/10 flex items-center gap-2.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#eee8d2] dark:bg-[#111c36] overflow-hidden shrink-0 relative flex items-center justify-center">
                    {isVideo ? (
                      <video src={task.previewUrl} className="w-full h-full object-cover" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={task.previewUrl} alt="thumb" className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-xs font-bold truncate max-w-[130px]" title={task.file.name}>
                        {task.file.name}
                      </span>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {task.speed}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>{formatBytes(task.file.size)}</span>
                      {task.status === 'completed' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span>{task.progress}%</span>
                      )}
                    </div>

                    <div className="w-full bg-[#eee8d2] dark:bg-[#111c36] h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          task.status === 'completed'
                            ? 'bg-[#ffda3f]'
                            : task.status === 'failed'
                            ? 'bg-rose-500'
                            : 'bg-[#ffda3f]'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    {task.status === 'uploading' && (
                      <button
                        onClick={() => pauseTask(task.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-[#060606] dark:hover:text-white"
                        title="Pause"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(task.status === 'paused' || task.status === 'failed') && (
                      <button
                        onClick={() => resumeTask(task.id)}
                        className="p-1 rounded-lg text-amber-600 hover:text-amber-700"
                        title="Retry"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Action Bar */}
          <div className="mt-3 pt-2 border-t border-[#e7dfcd] dark:border-white/12 flex items-center justify-between">
            {allCompleted ? (
              <button
                onClick={clearCompleted}
                className="w-full py-2 rounded-xl bg-[#ffda3f] hover:bg-[#e6c335] text-[#060606] font-sans text-xs font-bold transition active:scale-95 text-center shadow-md"
              >
                Dismiss Uploads
              </button>
            ) : (
              <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                Uploading in background. You can navigate freely.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
