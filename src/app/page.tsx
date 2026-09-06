'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  ShieldCheck,
  ArrowRight,
  User,
  Hash,
  FolderPlus,
  LogIn,
  FolderOpen,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export interface RecentRoomItem {
  code: string;
  name: string;
  memberId?: string;
  visitedAt: number;
  itemCount?: number;
  totalSize?: number;
}

export default function HomePage() {
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Form inputs
  const [roomNameInput, setRoomNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Recent Rooms List
  const [recentRooms, setRecentRooms] = useState<RecentRoomItem[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const router = useRouter();

  const loadRecentRooms = async () => {
    try {
      const raw = localStorage.getItem('drop_recent_rooms');
      if (!raw) return;
      const list: RecentRoomItem[] = JSON.parse(raw);

      const updatedList = await Promise.all(
        list.map(async (r) => {
          try {
            const res = await fetch(`/api/rooms/${r.code}`);
            if (res.ok) {
              const data = await res.json();
              return {
                ...r,
                name: data.name,
                itemCount: data.totalItemsCount,
                totalSize: data.totalStorageBytes,
              };
            }
          } catch (e) {
            // Keep cached metadata
          }
          return r;
        })
      );

      setRecentRooms(updatedList);
    } catch (err) {
      console.error('Error loading recent rooms:', err);
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem('drop_user_name');
    if (savedName) {
      setName(savedName);
      setIsEditingName(false);
    }

    loadRecentRooms();
  }, []);

  const saveToRecentRooms = (code: string, name: string, memberId?: string) => {
    try {
      const raw = localStorage.getItem('drop_recent_rooms');
      let list: RecentRoomItem[] = raw ? JSON.parse(raw) : [];

      list = list.filter((r) => r.code !== code);
      list.unshift({
        code,
        name,
        memberId,
        visitedAt: Date.now(),
      });

      localStorage.setItem('drop_recent_rooms', JSON.stringify(list.slice(0, 10)));
      setRecentRooms(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem('drop_user_name', name.trim());
      setIsEditingName(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setIsEditingName(true);
      return;
    }
    if (!roomNameInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomNameInput.trim(),
          creatorName: name.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      localStorage.setItem(`drop_member_${data.roomCode}`, data.creatorMemberId);
      localStorage.setItem(`drop_name_${data.roomCode}`, name.trim());
      localStorage.setItem('drop_user_name', name.trim());

      saveToRecentRooms(data.roomCode, data.roomName, data.creatorMemberId);

      router.push(`/r/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setIsEditingName(true);
      return;
    }
    if (!joinCodeInput.trim()) return;

    const cleanCode = joinCodeInput.trim().toUpperCase().replace('#', '');

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Room not found');

      localStorage.setItem(`drop_member_${data.roomCode}`, data.memberId);
      localStorage.setItem(`drop_name_${data.roomCode}`, name.trim());
      localStorage.setItem('drop_user_name', name.trim());

      saveToRecentRooms(data.roomCode, data.displayName || 'Shared Room', data.memberId);

      router.push(`/r/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Invalid room code');
    }
  };

  const handleCopyLink = async (code: string) => {
    const url = `${window.location.origin}/r/${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRemoveRecentRoom = (code: string) => {
    const updated = recentRooms.filter((r) => r.code !== code);
    setRecentRooms(updated);
    localStorage.setItem('drop_recent_rooms', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors pb-12">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="DropIT Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-2xl mx-auto mb-4 border border-white/20 hover:scale-105 transition-transform duration-300"
          />

          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-extrabold tracking-wide mb-3 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Original Quality • Zero Loss</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-black tracking-wide text-slate-950 dark:text-white mb-2 uppercase drop-shadow-sm">
            DropIT
          </h1>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Shared photo & video rooms. Nothing compressed.
          </p>
        </div>

        {/* STEP 1: ENTER YOUR NAME FIRST */}
        {isEditingName ? (
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl animate-scaleUp max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-inner">
              <User className="w-6 h-6" />
            </div>

            <h2 className="font-display text-xl font-black text-slate-950 dark:text-white mb-1 tracking-wide">
              Welcome! What is your name?
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Your uploaded media will be organized under your name.
            </p>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-display">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prathamesh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-display font-black text-sm tracking-wider uppercase transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: MAIN INTERFACE (CREATE OR JOIN ROOM) */
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl animate-scaleUp max-w-md">
            {/* User Profile Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-display font-black text-sm flex items-center justify-center shadow-md">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 font-display">
                    Sharing as
                  </span>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">{name}</span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold px-2 py-1"
              >
                Change Name
              </button>
            </div>

            {/* Tab Selector: Create vs Join */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900/90 border border-slate-300/60 dark:border-slate-800 mb-6">
              <button
                onClick={() => {
                  setActiveTab('create');
                  setError('');
                }}
                className={`py-2.5 text-xs font-display font-black tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create Room</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('join');
                  setError('');
                }}
                className={`py-2.5 text-xs font-display font-black tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'join'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Join Room</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 text-center font-bold">
                {error}
              </div>
            )}

            {/* CREATE ROOM FORM */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateRoom} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-xs uppercase font-display font-black tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gateway of India"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    autoFocus
                    required
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!roomNameInput.trim() || loading}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-display font-black text-sm tracking-wider uppercase transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
                >
                  <span>{loading ? 'Creating Room...' : 'Create & Enter Room'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* JOIN ROOM FORM */}
            {activeTab === 'join' && (
              <form onSubmit={handleJoinRoom} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-xs uppercase font-display font-black tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Room Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 7K92-XP"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      autoFocus
                      required
                      className="w-full py-3.5 pl-11 pr-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white font-mono text-center uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition text-sm tracking-wider font-bold"
                    />
                    <Hash className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-display font-black text-sm tracking-wider uppercase transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
                >
                  <span>Join Room</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* SECTION: YOUR ROOMS / RECENT ROOMS */}
        {recentRooms.length > 0 && (
          <div className="w-full mt-10 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Your Active Rooms ({recentRooms.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {recentRooms.map((room) => (
                <div
                  key={room.code}
                  onClick={() => router.push(`/r/${room.code}`)}
                  className="group relative p-3.5 sm:p-4 rounded-2xl glass-card border border-slate-200 dark:border-slate-800/80 hover:border-blue-500/50 cursor-pointer transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold shrink-0 group-hover:scale-105 transition-transform">
                      <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-black text-sm text-slate-900 dark:text-white truncate uppercase">
                          {room.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                          {room.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {room.itemCount !== undefined && (
                          <span>{room.itemCount} {room.itemCount === 1 ? 'item' : 'items'}</span>
                        )}
                        {room.totalSize !== undefined && (
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                            {formatBytes(room.totalSize)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(room.code);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition"
                      title="Copy room link"
                    >
                      {copiedCode === room.code ? (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRecentRoom(room.code);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                      title="Remove from recent rooms list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/r/${room.code}`);
                      }}
                      className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-display font-black tracking-wider uppercase transition shadow-md shadow-blue-500/20 flex items-center gap-1"
                    >
                      <span>Enter</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Minimal Footer */}
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-3">
          <span>DropIT • No Login required</span>
          <span>•</span>
          <span>Original Byte-for-Byte</span>
        </div>
      </main>
    </div>
  );
}
