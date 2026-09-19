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
        <h3 className="text-meta text-slate-600 dark:text-slate-400">
          Members ({members.length})
        </h3>
        {selectedMemberId !== null && (
          <button
            onClick={() => onSelectMember(null)}
            className="text-xs font-sans text-amber-600 dark:text-amber-400 hover:underline font-bold"
          >
            Show All Members
          </button>
        )}
      </div>

      <div className="flex overflow-x-auto pb-2 pt-1 gap-2.5 sm:gap-3 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-4 sm:overflow-visible no-scrollbar">
        {members.map((member) => {
          const isSelected = selectedMemberId === member.id;
          const isYou = currentMemberId === member.id;

          return (
            <div
              key={member.id}
              onClick={() => onSelectMember(isSelected ? null : member.id)}
              className={`group relative p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-200 min-w-[175px] sm:min-w-0 snap-start shrink-0 sm:shrink ${
                isSelected
                  ? 'bg-[#ffda3f]/20 border-[#ffda3f] shadow-lg shadow-amber-500/10 ring-2 ring-[#ffda3f]/40'
                  : 'glass-card border-[#e7dfcd] dark:border-white/12 hover:border-[#ffda3f]/60 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#ffda3f] text-[#060606] flex items-center justify-center text-xs font-sans font-extrabold shrink-0 shadow-xs">
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-sans font-bold text-xs sm:text-sm text-[#060606] dark:text-white truncate">
                    {member.displayName}
                  </span>
                  {isYou && (
                    <span className="text-[10px] sm:text-meta px-1.5 sm:px-2 py-0.5 rounded-full bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-amber-400 border border-[#e7dfcd] dark:border-white/15 shrink-0 font-bold">
                      You
                    </span>
                  )}
                </div>

                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-[#e7dfcd]/60 dark:border-white/10 font-sans font-medium">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {member.itemCount} {member.itemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="font-mono text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-slate-400" />
                  {formatBytes(member.totalSize)}
                </span>
              </div>

              {/* Touch & Hover actions */}
              <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#060606]/80 dark:bg-[#111c36]/90 backdrop-blur-md rounded-xl p-1 border border-slate-700 shadow-md">
                {onDownloadMemberZip && member.itemCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadMemberZip(member.id, member.displayName);
                    }}
                    className="p-1.5 rounded-lg text-white hover:bg-slate-800 transition-colors"
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
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors"
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

