'use client';

import React from 'react';
import { Play, Check, ShieldCheck, Image as ImageIcon, Trash2, Zap, Download } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { UploadTask } from '@/context/UploadContext';
import { MemberSummary } from './MemberList';

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
  groupByMember?: boolean;
  members?: MemberSummary[];
  currentMemberId?: string | null;
  onDownloadMemberZip?: (memberId: string, displayName: string) => void;
  selectedMemberName?: string;
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

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  optimisticTasks = [],
  selectedIds,
  onToggleSelect,
  onOpenViewer,
  onDeleteMedia,
  isSelecting,
  groupByMember = true,
  members = [],
  currentMemberId,
  onDownloadMemberZip,
  selectedMemberName,
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
        <h3 className="font-display text-2xl text-[#060606] dark:text-white mb-1">
          {selectedMemberName
            ? `${selectedMemberName} hasn't uploaded any memories yet`
            : 'No memories uploaded yet'}
        </h3>
        <p className="font-sans text-xs text-slate-600 dark:text-slate-400 max-w-sm">
          {selectedMemberName
            ? `When photos or videos are added by ${selectedMemberName}, they will appear right here.`
            : 'Tap + Add Memories above or drag & drop original photos and videos anywhere on screen.'}
        </p>
      </div>
    );
  }

  // Render Card for an Optimistic Upload Task
  const renderOptimisticCard = (task: UploadTask) => {
    const isVideo = task.file.type.startsWith('video/');
    const formatExt = getFormatBadge(task.file.name, task.file.type);
    const progressPercent = Math.max(0, Math.min(100, task.progress));
    const progressFraction = progressPercent / 100;
    const memberObj = members.find((m) => m.id === task.memberId);
    const uploaderName = memberObj
      ? memberObj.displayName
      : task.memberId === currentMemberId
      ? 'You'
      : 'Uploading...';

    const imageStyle: React.CSSProperties = {
      opacity: 0.88 + progressFraction * 0.12,
      filter: 'none',
      transition: 'opacity 0.2s ease',
    };

    return (
      <div
        key={`upload_${task.id}`}
        className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#0a0a0f] border border-[#ffda3f]/80 ring-2 ring-[#ffda3f]/40 shadow-xl select-none"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[#111625]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.previewUrl}
            alt={task.file.name}
            style={imageStyle}
            className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

          {/* Top Format Badge & Status */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-[#ffda3f] text-[#060606] shadow-md flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 fill-[#060606]" /> {formatExt}
            </span>
            <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold bg-black/75 text-[#ffda3f] border border-[#ffda3f]/50 backdrop-blur-md shadow-md">
              {task.status === 'failed' ? 'Failed' : `${progressPercent}%`}
            </span>
          </div>

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xl">
                <Play className="w-4 h-4 fill-white translate-x-0.5" />
              </div>
            </div>
          )}

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

        {/* Uploader & Progress Footer */}
        <div className="p-2.5 bg-[#0e1320] dark:bg-[#0c101d] border-t border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-[#ffda3f] text-[#060606] flex items-center justify-center text-[9px] font-sans font-black shrink-0 shadow-xs">
                {uploaderName.charAt(0).toUpperCase()}
              </div>
              <span className="font-sans font-bold text-xs text-[#ffda3f] truncate">
                {uploaderName}
              </span>
            </div>
            <span className="font-mono text-[10px] text-amber-300 font-bold shrink-0">
              {task.status === 'failed' ? 'Failed' : progressPercent >= 95 ? 'Finalizing' : task.speed}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 font-sans truncate" title={task.file.name}>
            {task.file.name}
          </div>
        </div>
      </div>
    );
  };

  // Render Card for Saved Database Media Item
  const renderSavedMediaCard = (item: MediaItemData) => {
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
        className={`group relative flex flex-col rounded-2xl overflow-hidden bg-[#0a0a0f] border cursor-pointer select-none transition-all duration-200 ${
          isSelected
            ? 'border-[#ffda3f] ring-2 ring-[#ffda3f]/60 shadow-xl shadow-amber-500/20'
            : 'border-[#e7dfcd] dark:border-white/12 hover:border-[#ffda3f]/60 hover:shadow-lg'
        }`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[#111625]">
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
                className="p-1 rounded-full bg-[#ffda3f] text-[#060606] backdrop-blur-md border border-amber-300 shadow-xs"
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

          {/* Video duration badge */}
          {isVideo && item.duration && (
            <div className="absolute bottom-2 right-2 pointer-events-none">
              <span className="font-mono text-white bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold border border-white/20">
                {formatDuration(item.duration)}
              </span>
            </div>
          )}
        </div>

        {/* Dedicated Footer Bar under photo: Uploader Name & File Info */}
        <div className="p-2.5 bg-[#0e1320] dark:bg-[#0c101d] border-t border-white/10 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-4 h-4 rounded-full bg-[#ffda3f] text-[#060606] flex items-center justify-center text-[9px] font-sans font-black shrink-0 shadow-xs">
                {item.memberName.charAt(0).toUpperCase()}
              </div>
              <span
                className="font-sans font-bold text-xs text-[#ffda3f] truncate"
                title={`Uploaded by ${item.memberName}`}
              >
                {item.memberName}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 shrink-0">
              {formatBytes(item.size)}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 font-sans truncate" title={item.originalFilename}>
            {item.originalFilename}
          </div>
        </div>
      </div>
    );
  };

  // Grouped by Member View Mode
  if (groupByMember) {
    // Collect all unique memberIds present in items or active tasks
    const memberGroupMap = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        items: MediaItemData[];
        tasks: UploadTask[];
        totalBytes: number;
      }
    >();

    // First populate from members list if provided to retain displayName ordering
    members.forEach((m) => {
      memberGroupMap.set(m.id, {
        memberId: m.id,
        memberName: m.displayName,
        items: [],
        tasks: [],
        totalBytes: 0,
      });
    });

    // Assign items to member groups
    items.forEach((item) => {
      let group = memberGroupMap.get(item.memberId);
      if (!group && item.memberName) {
        const matchedMember = members.find(
          (m) => m.displayName.toLowerCase().trim() === item.memberName.toLowerCase().trim()
        );
        if (matchedMember) {
          group = memberGroupMap.get(matchedMember.id);
        }
      }
      if (!group && item.memberName) {
        for (const g of memberGroupMap.values()) {
          if (g.memberName.toLowerCase().trim() === item.memberName.toLowerCase().trim()) {
            group = g;
            break;
          }
        }
      }
      if (!group) {
        group = {
          memberId: item.memberId,
          memberName: item.memberName || 'Member',
          items: [],
          tasks: [],
          totalBytes: 0,
        };
        memberGroupMap.set(item.memberId, group);
      }
      group.items.push(item);
      group.totalBytes += item.size;
    });

    // Assign optimistic tasks to member groups
    activeOptimisticTasks.forEach((task) => {
      let group = memberGroupMap.get(task.memberId);
      if (!group && task.memberId === currentMemberId) {
        const currentM = members.find((m) => m.id === currentMemberId);
        if (currentM) group = memberGroupMap.get(currentM.id);
      }
      if (!group) {
        for (const g of memberGroupMap.values()) {
          if (g.memberId === currentMemberId) {
            group = g;
            break;
          }
        }
      }
      if (!group) {
        const uploaderName = task.memberId === currentMemberId ? 'You' : 'Member';
        group = {
          memberId: task.memberId,
          memberName: uploaderName,
          items: [],
          tasks: [],
          totalBytes: 0,
        };
        memberGroupMap.set(task.memberId, group);
      }
      group.tasks.push(task);
    });

    // Keep member groups list sorted: current user first, then members with items, then recent joiners
    const allMemberGroups = Array.from(memberGroupMap.values());
    allMemberGroups.sort((a, b) => {
      if (a.memberId === currentMemberId) return -1;
      if (b.memberId === currentMemberId) return 1;
      const countA = a.items.length + a.tasks.length;
      const countB = b.items.length + b.tasks.length;
      if (countA !== countB) return countB - countA;
      return a.memberName.localeCompare(b.memberName);
    });

    return (
      <div className="space-y-8">
        {allMemberGroups.map((group) => {
          const isYou = group.memberId === currentMemberId;
          const totalCount = group.items.length + group.tasks.length;

          return (
            <div
              key={`group_${group.memberId}`}
              className="space-y-3.5 p-4 sm:p-5 rounded-3xl glass-card border border-[#e7dfcd] dark:border-white/10 shadow-lg"
            >
              {/* Member Section Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e7dfcd]/80 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#ffda3f] text-[#060606] flex items-center justify-center text-sm font-sans font-black shadow-md">
                    {group.memberName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-sans font-bold text-base sm:text-lg text-[#060606] dark:text-white">
                        {group.memberName}'s Media
                      </h4>
                      {isYou && (
                        <span className="text-meta px-2 py-0.5 rounded-full bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-amber-400 border border-[#e7dfcd] dark:border-white/15 font-bold">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-sans font-medium flex items-center gap-2">
                      <span>
                        {totalCount} {totalCount === 1 ? 'item' : 'items'}
                      </span>
                      {group.totalBytes > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                            {formatBytes(group.totalBytes)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {onDownloadMemberZip && group.items.length > 0 && (
                  <button
                    onClick={() => onDownloadMemberZip(group.memberId, group.memberName)}
                    className="py-2 px-3.5 rounded-2xl bg-[#eee8d2]/80 dark:bg-[#111c36]/80 hover:bg-[#eee8d2] dark:hover:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 text-[#060606] dark:text-slate-200 text-xs font-sans font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                    title={`Download all original files uploaded by ${group.memberName}`}
                  >
                    <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">Download {group.memberName}'s Files</span>
                    <span className="sm:hidden">Download</span>
                  </button>
                )}
              </div>

              {/* Member Media Grid or Empty State */}
              {totalCount > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
                  {group.tasks.map((task) => renderOptimisticCard(task))}
                  {group.items.map((item) => renderSavedMediaCard(item))}
                </div>
              ) : (
                <div className="py-5 px-4 text-center rounded-2xl bg-[#fff9e9]/50 dark:bg-[#0a0a0f]/50 border border-dashed border-[#e7dfcd] dark:border-white/10 text-xs font-sans text-slate-500 dark:text-slate-400">
                  <span>No photos or videos uploaded by {group.memberName} yet.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Combined Timeline Grid View Mode
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
      {activeOptimisticTasks.map((task) => renderOptimisticCard(task))}
      {items.map((item) => renderSavedMediaCard(item))}
    </div>
  );
};

