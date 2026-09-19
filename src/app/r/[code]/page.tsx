'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { DayNightBackground } from '@/components/DayNightBackground';
import { QrModal } from '@/components/QrModal';
import { MemberList, MemberSummary } from '@/components/MemberList';
import { MediaGrid, MediaItemData } from '@/components/MediaGrid';
import { MediaViewer } from '@/components/MediaViewer';
import { AddMediaModal } from '@/components/AddMediaModal';
import { MultiSelectBar } from '@/components/MultiSelectBar';
import { ToastFeed, ToastMessage } from '@/components/ToastFeed';
import {
  Plus,
  Download,
  Trash2,
  Users,
  WifiOff,
  AlertTriangle,
  FolderOpen,
  LayoutGrid,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useUpload } from '@/context/UploadContext';

interface RoomData {
  roomId: string;
  roomCode: string;
  name: string;
  createdBy?: string;
  totalMembers: number;
  totalItemsCount: number;
  totalStorageBytes: number;
  members: MemberSummary[];
  mediaItems: MediaItemData[];
  isOwner?: boolean;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const { tasks } = useUpload();

  // Room state
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // User Session
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [joinNameInput, setJoinNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Gallery & Selection Filter
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [activeViewerItem, setActiveViewerItem] = useState<MediaItemData | null>(null);
  const [groupByMember, setGroupByMember] = useState(true);

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Downloads & Notifications
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const fetchRoomData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const token = localStorage.getItem(`drop_token_${code}`);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        try {
          document.cookie = `drop_token_${code}=${token}; path=/; SameSite=Lax; max-age=31536000`;
        } catch (e) {}
      }
      const res = await fetch(`/api/rooms/${code}`, { headers });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch room');

      const data: RoomData = await res.json();
      setRoom(data);
      setNotFound(false);

      // Save room to recent rooms list
      try {
        const raw = localStorage.getItem('drop_recent_rooms');
        let list = raw ? JSON.parse(raw) : [];
        list = list.filter((r: any) => r.code !== data.roomCode);
        list.unshift({ code: data.roomCode, name: data.name, visitedAt: Date.now() });
        localStorage.setItem('drop_recent_rooms', JSON.stringify(list.slice(0, 10)));
      } catch (e) {
        console.error(e);
      }

      let storedMemberId: string | null = null;
      try {
        storedMemberId = localStorage.getItem(`drop_member_${data.roomCode}`);
      } catch (e) {}

      if (storedMemberId) {
        setCurrentMemberId(storedMemberId);
      } else {
        let globalName: string | null = null;
        try {
          globalName = localStorage.getItem('drop_user_name');
        } catch (e) {}

        if (globalName && globalName.trim()) {
          setJoinNameInput(globalName.trim());
          // Seamlessly join room with device cached name
          try {
            const joinRes = await fetch(`/api/rooms/${data.roomCode}/join`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ displayName: globalName.trim() }),
            });
            if (joinRes.ok) {
              const joinData = await joinRes.json();
              if (joinData.token) {
                try {
                  localStorage.setItem(`drop_token_${joinData.roomCode}`, joinData.token);
                  document.cookie = `drop_token_${joinData.roomCode}=${joinData.token}; path=/; SameSite=Lax; max-age=31536000`;
                } catch (e) {}
              }
              try {
                localStorage.setItem(`drop_member_${joinData.roomCode}`, joinData.memberId);
                localStorage.setItem(`drop_name_${joinData.roomCode}`, joinData.displayName);
              } catch (e) {}
              setCurrentMemberId(joinData.memberId);
            }
          } catch (joinErr) {
            console.error('Auto-join with device name failed:', joinErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomData();

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [code]);

  useEffect(() => {
    if (!room?.roomCode) return;

    const eventSource = new EventSource(`/api/rooms/${room.roomCode}/events`);

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'ROOM_DELETED') {
          setIsDeleted(true);
          return;
        }

        if (payload.type === 'MEMBER_JOINED') {
          addToast(`${payload.memberName} joined the room`, 'join');
          fetchRoomData(true);
        } else if (payload.type === 'MEDIA_ADDED') {
          addToast(`${payload.memberName} added "${payload.filename}"`, 'upload');
          fetchRoomData(true);
        } else if (payload.type === 'MEMBER_REMOVED' || payload.type === 'ROOM_UPDATED') {
          fetchRoomData(true);
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [room?.roomCode]);

  const addToast = (text: string, type: 'join' | 'upload' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = joinNameInput.trim();
    if (!cleanName) return;

    setJoining(true);
    setJoinError('');

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: cleanName }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = {};
      }
      if (!res.ok) throw new Error(data.error || 'Failed to join room');

      try {
        if (data.token) {
          localStorage.setItem(`drop_token_${data.roomCode}`, data.token);
          document.cookie = `drop_token_${data.roomCode}=${data.token}; path=/; SameSite=Lax; max-age=31536000`;
        }
        localStorage.setItem(`drop_member_${data.roomCode}`, data.memberId);
        localStorage.setItem(`drop_name_${data.roomCode}`, data.displayName);
        localStorage.setItem('drop_user_name', data.displayName);
      } catch (e) {}

      setCurrentMemberId(data.memberId);
      await fetchRoomData(true);
    } catch (err: any) {
      setJoinError(err.message || 'Error joining room');
    } finally {
      setJoining(false);
    }
  };

  const displayedMedia = room
    ? selectedMemberId
      ? room.mediaItems.filter((m) => m.memberId === selectedMemberId)
      : room.mediaItems
    : [];

  const handleToggleSelectMedia = (id: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (selectedMediaIds.size === displayedMedia.length) {
      setSelectedMediaIds(new Set());
    } else {
      setSelectedMediaIds(new Set(displayedMedia.map((m) => m.id)));
    }
  };

  const triggerZipDownload = async (bodyPayload: any, filename: string) => {
    setIsGeneratingZip(true);
    try {
      const token = localStorage.getItem(`drop_token_${room?.roomCode || code}`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/download/zip', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...bodyPayload, token }),
      });

      if (!res.ok) throw new Error('ZIP generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading ZIP:', err);
      alert('Could not generate zero-loss ZIP package');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleDownloadSelected = () => {
    if (!room || selectedMediaIds.size === 0) return;
    triggerZipDownload(
      { roomId: room.roomId, mediaIds: Array.from(selectedMediaIds) },
      `${room.name.replace(/\s+/g, '_')}-Selected.zip`
    );
  };

  const handleDownloadMemberZip = (memberId: string, displayName: string) => {
    if (!room) return;
    triggerZipDownload(
      { roomId: room.roomId, memberId },
      `${room.name.replace(/\s+/g, '_')}-${displayName}.zip`
    );
  };

  const handleDownloadAllRoom = () => {
    if (!room) return;
    triggerZipDownload(
      { roomId: room.roomId },
      `${room.name.replace(/\s+/g, '_')}-FullRoom.zip`
    );
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!room) return;
    try {
      const token = localStorage.getItem(`drop_token_${room.roomCode}`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'REMOVE_MEMBER', memberId, token }),
      });
      fetchRoomData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!room) return;
    try {
      const token = localStorage.getItem(`drop_token_${room.roomCode}`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'DELETE_MEDIA', mediaId, token }),
      });
      if (res.ok) {
        setSelectedMediaIds((prev) => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
        if (activeViewerItem?.id === mediaId) {
          setActiveViewerItem(null);
        }
        addToast('Photo/Video deleted', 'info');
        fetchRoomData(true);
      }
    } catch (e) {
      console.error('Error deleting media:', e);
    }
  };

  const handleDeleteSelectedMedia = async () => {
    if (!room || selectedMediaIds.size === 0) return;
    const count = selectedMediaIds.size;
    if (!confirm(`Delete ${count} selected item${count === 1 ? '' : 's'} from room?`)) return;

    try {
      const token = localStorage.getItem(`drop_token_${room.roomCode}`);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'DELETE_MULTIPLE_MEDIA', mediaIds: Array.from(selectedMediaIds), token }),
      });
      if (res.ok) {
        setSelectedMediaIds(new Set());
        setActiveViewerItem(null);
        addToast(`Deleted ${count} item${count === 1 ? '' : 's'}`, 'info');
        fetchRoomData(true);
      }
    } catch (e) {
      console.error('Error deleting selected media:', e);
    }
  };

  const roomUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleNativeShare = async () => {
    if (navigator.share && room) {
      try {
        await navigator.share({
          title: `Join ${room.name} on DropIT`,
          text: `Upload & download zero-loss original photos/videos`,
          url: roomUrl,
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      setShowQrModal(true);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col relative transition-colors duration-500">
        <DayNightBackground />
        <Navbar showBack />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-display text-3xl text-[#060606] dark:text-white mb-2">Room Not Found</h2>
          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-6 font-normal">
            The room code <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">#{code}</span> does not exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/')}
            className="py-3.5 px-6 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] text-[#060606] font-sans font-bold text-xs shadow-md shadow-amber-500/15 active:scale-95 transition-all"
          >
            Back to Home
          </button>
        </main>
      </div>
    );
  }

  if (isDeleted) {
    return (
      <div className="min-h-screen flex flex-col relative transition-colors duration-500">
        <DayNightBackground />
        <Navbar showBack />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
          <div className="w-16 h-16 rounded-3xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/12 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
            <Trash2 className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="font-display text-3xl text-[#060606] dark:text-white mb-2">Room Deleted</h2>
          <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-6 font-normal">
            This shared media room has been closed by its creator.
          </p>
          <button
            onClick={() => router.push('/')}
            className="py-3.5 px-6 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] text-[#060606] font-sans font-bold text-xs shadow-md shadow-amber-500/15 active:scale-95 transition-all"
          >
            Back to Home
          </button>
        </main>
      </div>
    );
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex flex-col relative transition-colors duration-500">
        <DayNightBackground />
        <Navbar />
        <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
          <div className="h-24 rounded-3xl bg-[#eee8d2]/60 dark:bg-[#111c36]/60 border border-[#e7dfcd] dark:border-white/10" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-[#eee8d2]/40 dark:bg-[#111c36]/40 border border-[#e7dfcd] dark:border-white/10" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-[#eee8d2]/60 dark:bg-[#111c36]/60 border border-[#e7dfcd] dark:border-white/10" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!currentMemberId) {
    return (
      <div className="min-h-screen flex flex-col relative transition-colors duration-500">
        <DayNightBackground />
        <Navbar showBack roomName={room.name} roomCode={room.roomCode} />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto my-auto w-full animate-fadeIn">
          <div className="w-full glass-card p-8 rounded-3xl shadow-xl text-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-slate-200 border border-[#e7dfcd] dark:border-white/15 text-meta mb-4">
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Join Memory Room</span>
            </div>

            <h2 className="font-display text-3xl text-[#060606] dark:text-white uppercase tracking-wide mb-1 leading-tight">
              {room.name}
            </h2>
            <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-6 font-mono font-semibold">
              Code: <span className="text-amber-600 dark:text-amber-400 font-bold">#{room.roomCode}</span>
            </p>

            {joinError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 font-sans font-bold">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-meta text-slate-600 dark:text-slate-400 mb-2">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={joinNameInput}
                  onChange={(e) => setJoinNameInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/15 focus:border-[#ffda3f] text-[#060606] dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-sans font-semibold shadow-xs"
                />
              </div>

              <button
                type="submit"
                disabled={!joinNameInput.trim() || joining}
                className="w-full py-4 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] disabled:opacity-50 text-[#060606] font-sans font-bold text-sm transition-all shadow-xl shadow-amber-500/20 active:scale-95"
              >
                {joining ? 'Joining...' : 'Join Room'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const selectedMemberObj = room.members.find((m) => m.id === selectedMemberId);
  const totalSelectedBytes = Array.from(selectedMediaIds).reduce((acc, id) => {
    const item = room.mediaItems.find((m) => m.id === id);
    return acc + (item ? item.size : 0);
  }, 0);

  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-500 pb-12">
      <DayNightBackground />
      <ToastFeed toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((item) => item.id !== id))} />

      {isOffline && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-amber-600 dark:text-amber-300 text-xs font-sans font-bold flex items-center justify-center gap-2 relative z-50">
          <WifiOff className="w-4 h-4" />
          <span>Network connection interrupted. Uploads will auto-resume once reconnected.</span>
        </div>
      )}

      {isGeneratingZip && (
        <div className="fixed inset-x-0 top-0 z-50 bg-[#ffda3f] text-[#060606] px-4 py-3 text-center text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-2xl animate-pulse">
          <Download className="w-4 h-4 animate-bounce" />
          <span>Packaging Zero-Loss Originals into ZIP Archive... Please wait.</span>
        </div>
      )}

      <Navbar
        roomName={room.name}
        roomCode={room.roomCode}
        onOpenQr={() => setShowQrModal(true)}
        onShare={handleNativeShare}
        showBack
      />

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Room Central Header Card */}
        <div className="p-6 rounded-3xl glass-card shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="font-display text-3xl sm:text-4xl text-[#060606] dark:text-white uppercase tracking-tight">
                {room.name}
              </h1>
              <span className="px-3 py-0.5 rounded-full font-mono text-xs font-bold bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-amber-400 border border-[#e7dfcd] dark:border-white/15">
                #{room.roomCode}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-sans font-medium flex-wrap">
              <span>{room.totalMembers} {room.totalMembers === 1 ? 'member' : 'members'}</span>
              <span>•</span>
              <span>
                {room.totalItemsCount} {room.totalItemsCount === 1 ? 'item' : 'items'}
              </span>
              <span>•</span>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                {formatBytes(room.totalStorageBytes)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {room.totalItemsCount > 0 && (
              <button
                onClick={handleDownloadAllRoom}
                className="py-3 px-4 rounded-2xl bg-[#eee8d2]/80 dark:bg-[#111c36]/80 hover:bg-[#eee8d2] dark:hover:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 text-[#060606] dark:text-slate-200 text-xs font-sans font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                title="Download all original files from room"
              >
                <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Download All</span>
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-initial py-3.5 px-6 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] text-[#060606] font-sans font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>+ Add Memories</span>
            </button>
          </div>
        </div>

        {/* Member Section List */}
        <MemberList
          members={room.members}
          selectedMemberId={selectedMemberId}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            setSelectedMediaIds(new Set());
          }}
          currentMemberId={currentMemberId}
          onDownloadMemberZip={handleDownloadMemberZip}
          onRemoveMember={handleRemoveMember}
          isCreator={room.isOwner ?? false}
        />

        {/* Media Gallery Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-3">
              <h3 className="text-meta text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {selectedMemberObj
                    ? `${selectedMemberObj.displayName}'s Media (${displayedMedia.length})`
                    : `Media Gallery (${displayedMedia.length})`}
                </span>
              </h3>

              {/* View Mode Toggle: Grouped by User vs Timeline */}
              {!selectedMemberId && displayedMedia.length > 0 && (
                <div className="flex items-center bg-[#eee8d2] dark:bg-[#111c36] p-0.5 rounded-xl border border-[#e7dfcd] dark:border-white/15">
                  <button
                    onClick={() => setGroupByMember(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 ${
                      groupByMember
                        ? 'bg-[#ffda3f] text-[#060606] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-[#060606] dark:hover:text-white'
                    }`}
                    title="Group photos and videos by uploader"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>By User</span>
                  </button>
                  <button
                    onClick={() => setGroupByMember(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 ${
                      !groupByMember
                        ? 'bg-[#ffda3f] text-[#060606] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-[#060606] dark:hover:text-white'
                    }`}
                    title="Show all photos and videos in a combined timeline"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Timeline</span>
                  </button>
                </div>
              )}
            </div>

            {displayedMedia.length > 0 && (
              <button
                onClick={handleSelectAllToggle}
                className="text-xs font-sans text-slate-600 dark:text-slate-400 hover:text-[#060606] dark:hover:text-white transition font-bold self-end sm:self-auto"
              >
                {selectedMediaIds.size === displayedMedia.length ? 'Deselect All' : 'Select'}
              </button>
            )}
          </div>

          <MediaGrid
            items={displayedMedia}
            optimisticTasks={room ? tasks.filter((t) => t.roomId === room.roomId) : []}
            selectedIds={selectedMediaIds}
            onToggleSelect={handleToggleSelectMedia}
            onOpenViewer={(item) => setActiveViewerItem(item)}
            onDeleteMedia={handleDeleteMedia}
            isSelecting={selectedMediaIds.size > 0}
            groupByMember={selectedMemberId ? false : groupByMember}
            members={room.members}
            currentMemberId={currentMemberId}
            onDownloadMemberZip={handleDownloadMemberZip}
          />
        </div>
      </main>

      {selectedMediaIds.size > 0 && (
        <MultiSelectBar
          selectedCount={selectedMediaIds.size}
          totalBytes={totalSelectedBytes}
          onClearSelection={() => setSelectedMediaIds(new Set())}
          onDownloadSelected={handleDownloadSelected}
          onDownloadAll={handleDownloadAllRoom}
          onSelectAllToggle={handleSelectAllToggle}
          onDeleteSelected={handleDeleteSelectedMedia}
          isAllSelected={selectedMediaIds.size === displayedMedia.length}
        />
      )}

      <MediaViewer
        item={activeViewerItem}
        items={displayedMedia}
        onClose={() => setActiveViewerItem(null)}
        onSelect={(item) => setActiveViewerItem(item)}
        onDeleteMedia={handleDeleteMedia}
      />

      <AddMediaModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        roomId={room.roomId}
        memberId={currentMemberId}
        roomCode={room.roomCode}
        onUploadSuccess={() => fetchRoomData(true)}
      />

      <QrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        roomCode={room.roomCode}
        roomName={room.name}
        roomUrl={roomUrl}
      />
    </div>
  );
}

