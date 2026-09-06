'use client';

import React from 'react';
import { User, HardDrive, Download, Trash2, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export interface MemberSummary {
  id: string;
  displayName: string;
  joinedAt: string;
  itemCount: number;
  totalSize: number;
}

interface MemberListProps {
  members: MemberSummary[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  currentMemberId: string | null;
  onDownloadMemberZip?: (memberId: string, displayName: string) => void;
  onRemoveMember?: (memberId: string) => void;
  isCreator?: boolean;
}

export const MemberList: React.FC<MemberListProps> = ({
  members,
  selectedMemberId,
  onSelectMember,
  currentMemberId,
  onDownloadMemberZip,
  onRemoveMember,
  isCreator = false,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-display text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Members ({members.length})
        </h3>
        {selectedMemberId !== null && (
          <button
            onClick={() => onSelectMember(null)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
          >
            Show All Members
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {members.map((member) => {
          const isSelected = selectedMemberId === member.id;
          const isYou = currentMemberId === member.id;

          return (
            <div
              key={member.id}
              onClick={() => onSelectMember(isSelected ? null : member.id)}
              className={`group relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/40'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {member.displayName}
                  </span>
                  {isYou && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-extrabold shrink-0">
                      You
                    </span>
                  )}
                </div>

                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {member.itemCount} {member.itemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-slate-400" />
                  {formatBytes(member.totalSize)}
                </span>
              </div>

              {/* Hover actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 dark:bg-slate-950/90 rounded-lg p-1 border border-slate-700">
                {onDownloadMemberZip && member.itemCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadMemberZip(member.id, member.displayName);
                    }}
                    className="p-1 rounded text-white hover:bg-slate-800"
                    title={`Download ${member.displayName}'s files`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                {isCreator && !isYou && onRemoveMember && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove ${member.displayName} from room?`)) {
                        onRemoveMember(member.id);
                      }
                    }}
                    className="p-1 rounded text-rose-400 hover:bg-rose-950/40"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
