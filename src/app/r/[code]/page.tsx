'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
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
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

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
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

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
      const res = await fetch(`/api/rooms/${code}`);
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

      const storedMemberId = localStorage.getItem(`drop_member_${data.roomCode}`);
      if (storedMemberId && data.members.some((m) => m.id === storedMemberId)) {
        setCurrentMemberId(storedMemberId);
      } else {
        const globalName = localStorage.getItem('drop_user_name');
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
              localStorage.setItem(`drop_member_${joinData.roomCode}`, joinData.memberId);
              localStorage.setItem(`drop_name_${joinData.roomCode}`, joinData.displayName);
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
    if (!joinNameInput.trim()) return;

    setJoining(true);
    setJoinError('');

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: joinNameInput.trim() }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = {};
      }
      if (!res.ok) throw new Error(data.error || 'Failed to join room');

      localStorage.setItem(`drop_member_${data.roomCode}`, data.memberId);
      localStorage.setItem(`drop_name_${data.roomCode}`, data.displayName);
      localStorage.setItem('drop_user_name', data.displayName);
      setCurrentMemberId(data.memberId);

      fetchRoomData(true);
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
      const res = await fetch('/api/download/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
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
      await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE_MEMBER', memberId }),
      });
      fetchRoomData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_MEDIA', mediaId }),
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
      const res = await fetch(`/api/rooms/${room.roomCode}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_MULTIPLE_MEDIA', mediaIds: Array.from(selectedMediaIds) }),
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
          title: `Join ${room.name} on DROP`,
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
      <div className="min-h-screen flex flex-col transition-colors">
        <Navbar showBack />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Room Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
            The room code <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{code}</span> does not exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/')}
            className="py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/20"
          >
            Back to Home
          </button>
        </main>
      </div>
    );
  }

  if (isDeleted) {
    return (
      <div className="min-h-screen flex flex-col transition-colors">
        <Navbar showBack />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mb-4">
            <Trash2 className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Room Deleted</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
            This shared media room has been closed by its creator.
          </p>
          <button
            onClick={() => router.push('/')}
            className="py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/20"
          >
            Back to Home
          </button>
        </main>
      </div>
    );
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex flex-col transition-colors">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
          <div className="h-20 rounded-3xl bg-slate-200/60 dark:bg-slate-900/60 border border-slate-300/40 dark:border-slate-800/60" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-200/40 dark:bg-slate-900/40 border border-slate-300/40 dark:border-slate-800/40" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-slate-200/60 dark:bg-slate-900/60 border border-slate-300/40 dark:border-slate-800/60" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!currentMemberId) {
    return (
      <div className="min-h-screen flex flex-col transition-colors">
        <Navbar showBack roomName={room.name} roomCode={room.roomCode} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto my-auto w-full animate-fadeIn">
          <div className="w-full glass-card p-8 rounded-3xl shadow-2xl text-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-extrabold mb-4">
              <Users className="w-3.5 h-3.5" />
              <span>Join Room</span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide mb-1">
              {room.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-mono font-semibold">
              Code: <span className="text-blue-600 dark:text-blue-400 font-bold">{room.roomCode}</span>
            </p>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 font-bold">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul"
                  value={joinNameInput}
                  onChange={(e) => setJoinNameInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={!joinNameInput.trim() || joining}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm transition shadow-xl shadow-blue-500/25 glow-blue"
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
    <div className="min-h-screen flex flex-col transition-colors">
      <ToastFeed toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((item) => item.id !== id))} />

      {isOffline && (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-amber-600 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>Network connection interrupted. Uploads will auto-resume once reconnected.</span>
        </div>
      )}

      {isGeneratingZip && (
        <div className="fixed inset-x-0 top-0 z-50 bg-blue-600 text-white px-4 py-3 text-center text-xs font-extrabold flex items-center justify-center gap-2 shadow-2xl animate-pulse">
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

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Room Central Header */}
        <div className="p-6 rounded-3xl glass-card shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-wide uppercase">
                {room.name}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-mono font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {room.roomCode}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-bold">
              <span>{room.totalMembers} people</span>
              <span>•</span>
              <span>
                {room.totalItemsCount} {room.totalItemsCount === 1 ? 'item' : 'items'}
              </span>
              <span>•</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                {formatBytes(room.totalStorageBytes)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {room.totalItemsCount > 0 && (
              <button
                onClick={handleDownloadAllRoom}
                className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
                title="Download all original files from room"
              >
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Download All</span>
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-initial py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/25 hover:scale-[1.02] glow-blue"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>Add</span>
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
          isCreator={true}
        />

        {/* Media Gallery Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                {selectedMemberObj
                  ? `${selectedMemberObj.displayName}'s Media (${displayedMedia.length})`
                  : `All Media (${displayedMedia.length})`}
              </span>
            </h3>

            {displayedMedia.length > 0 && (
              <button
                onClick={handleSelectAllToggle}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition font-bold"
              >
                {selectedMediaIds.size === displayedMedia.length ? 'Deselect All' : 'Select'}
              </button>
            )}
          </div>

          <MediaGrid
            items={displayedMedia}
            selectedIds={selectedMediaIds}
            onToggleSelect={handleToggleSelectMedia}
            onOpenViewer={(item) => setActiveViewerItem(item)}
            onDeleteMedia={handleDeleteMedia}
            isSelecting={selectedMediaIds.size > 0}
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
