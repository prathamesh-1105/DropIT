'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { DayNightBackground } from '@/components/DayNightBackground';
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
  Sparkles,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

import { Logo } from '@/components/Logo';

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
    try {
      const savedName = localStorage.getItem('drop_user_name');
      if (savedName && savedName.trim()) {
        setName(savedName.trim());
        setIsEditingName(false);
      }
    } catch (e) {
      console.warn('localStorage read error:', e);
    }

    // Check URL parameters for join code (e.g. ?join=7K92XP or ?code=7K92XP)
    try {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('join') || params.get('code');
      if (codeParam) {
        setJoinCodeInput(codeParam.trim().toUpperCase());
        setActiveTab('join');
      }
    } catch (e) {}

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
    const cleanName = name.trim();
    if (cleanName) {
      try {
        localStorage.setItem('drop_user_name', cleanName);
      } catch (e) {
        console.warn('localStorage error:', e);
      }
      setName(cleanName);
      setIsEditingName(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
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
          creatorName: cleanName,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = {};
      }
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      try {
        localStorage.setItem(`drop_member_${data.roomCode}`, data.creatorMemberId);
        localStorage.setItem(`drop_name_${data.roomCode}`, cleanName);
        localStorage.setItem('drop_user_name', cleanName);
        if (data.token) {
          localStorage.setItem(`drop_token_${data.roomCode}`, data.token);
          document.cookie = `drop_token_${data.roomCode}=${data.token}; path=/; SameSite=Lax; max-age=31536000`;
        }
      } catch (e) {}

      saveToRecentRooms(data.roomCode, data.roomName, data.creatorMemberId);

      router.push(`/r/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setIsEditingName(true);
      return;
    }
    if (!joinCodeInput.trim()) return;

    const cleanCode = joinCodeInput.trim().toUpperCase().replace('#', '');
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
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
      if (!res.ok) throw new Error(data.error || 'Room not found');

      try {
        localStorage.setItem(`drop_member_${data.roomCode}`, data.memberId);
        localStorage.setItem(`drop_name_${data.roomCode}`, cleanName);
        localStorage.setItem('drop_user_name', cleanName);
        if (data.token) {
          localStorage.setItem(`drop_token_${data.roomCode}`, data.token);
          document.cookie = `drop_token_${data.roomCode}=${data.token}; path=/; SameSite=Lax; max-age=31536000`;
        }
      } catch (e) {}

      saveToRecentRooms(data.roomCode, data.displayName || 'Shared Room', data.memberId);

      router.push(`/r/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Invalid room code');
      setLoading(false);
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
    <div className="min-h-screen flex flex-col relative transition-colors duration-500 pb-16">
      <DayNightBackground />
      <Navbar />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-xl mx-auto w-full animate-fadeIn">
        {/* Hero Brand Section */}
        <div className="text-center mb-6 sm:mb-8 pt-2 flex flex-col items-center">
          <Logo size="lg" showSubtitle className="mb-4" />

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-slate-200 border border-[#e7dfcd] dark:border-white/15 text-meta mb-3 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Original Quality • Zero Loss</span>
          </div>


          <h1 className="font-display text-5xl sm:text-6xl text-[#060606] dark:text-white mb-2 leading-tight">
            Share Memories Untouched
          </h1>
          <p className="font-sans text-sm sm:text-base font-normal text-slate-700 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            Full-resolution photo & video rooms. No compression, no account needed.
          </p>
        </div>

        {/* 3-STEP VISUAL GUIDE CARD */}
        <div className="w-full glass-card p-5 sm:p-6 rounded-3xl mb-6 shadow-lg border border-[#e7dfcd] dark:border-white/12">
          <div className="flex items-center gap-1.5 mb-3 text-meta text-slate-600 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>How DropIT Works</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-[#fff9e9]/80 dark:bg-[#0a0a0f]/80 border border-[#e7dfcd] dark:border-white/10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#ffda3f] text-[#060606] font-display text-sm flex items-center justify-center mb-1.5 font-bold shadow-xs">
                1
              </div>
              <span className="font-sans text-xs font-bold text-[#060606] dark:text-white mb-0.5">Create Room</span>
              <span className="font-sans text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Name your event or trip</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fff9e9]/80 dark:bg-[#0a0a0f]/80 border border-[#e7dfcd] dark:border-white/10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#fc9073] text-[#060606] font-display text-sm flex items-center justify-center mb-1.5 font-bold shadow-xs">
                2
              </div>
              <span className="font-sans text-xs font-bold text-[#060606] dark:text-white mb-0.5">Share Code</span>
              <span className="font-sans text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Send link or QR code</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#fff9e9]/80 dark:bg-[#0a0a0f]/80 border border-[#e7dfcd] dark:border-white/10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#71b7f4] text-[#060606] font-display text-sm flex items-center justify-center mb-1.5 font-bold shadow-xs">
                3
              </div>
              <span className="font-sans text-xs font-bold text-[#060606] dark:text-white mb-0.5">Upload</span>
              <span className="font-sans text-[11px] text-slate-600 dark:text-slate-400 leading-tight">Everyone adds photos</span>
            </div>
          </div>
        </div>

        {/* STEP 1: ENTER YOUR NAME FIRST */}
        {isEditingName ? (
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-xl animate-scaleUp max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-[#eee8d2] dark:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 flex items-center justify-center text-[#060606] dark:text-slate-100 mb-4 shadow-inner">
              <User className="w-6 h-6" />
            </div>

            <h2 className="font-display text-2xl sm:text-3xl text-[#060606] dark:text-white mb-1 leading-tight">
              Welcome! What is your name?
            </h2>
            <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mb-6 font-normal">
              Your uploaded photos & videos will be organized under your name.
            </p>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-meta text-slate-600 dark:text-slate-400 mb-2">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prathamesh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/15 focus:border-[#ffda3f] text-[#060606] dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-sans font-semibold shadow-xs"
                />
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full py-4 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] disabled:opacity-50 text-[#060606] font-sans font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: MAIN INTERFACE (CREATE OR JOIN ROOM) */
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-xl animate-scaleUp max-w-md">
            {/* User Profile Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/12 mb-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#ffda3f] text-[#060606] font-sans font-bold text-sm flex items-center justify-center shadow-xs">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-meta text-slate-500 dark:text-slate-400">
                    Sharing as
                  </span>
                  <span className="font-sans font-bold text-sm text-[#060606] dark:text-white">{name}</span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs font-sans text-amber-600 dark:text-amber-400 hover:underline font-bold px-2 py-1"
              >
                Change Name
              </button>
            </div>

            {/* Tab Selector: Large Clear Touch Targets */}
            <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#eee8d2]/80 dark:bg-[#0a0a0f]/90 border border-[#e7dfcd] dark:border-white/12 mb-6">
              <button
                onClick={() => {
                  setActiveTab('create');
                  setError('');
                }}
                className={`py-3 text-xs font-sans font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 ${
                  activeTab === 'create'
                    ? 'bg-[#ffda3f] text-[#060606] shadow-sm'
                    : 'text-slate-700 dark:text-slate-400 hover:text-[#060606] dark:hover:text-white'
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create a Room</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('join');
                  setError('');
                }}
                className={`py-3 text-xs font-sans font-bold tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 ${
                  activeTab === 'join'
                    ? 'bg-[#ffda3f] text-[#060606] shadow-sm'
                    : 'text-slate-700 dark:text-slate-400 hover:text-[#060606] dark:hover:text-white'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Join a Room</span>
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 text-center font-sans font-bold">
                {error}
              </div>
            )}

            {/* CREATE ROOM FORM */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateRoom} className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block text-meta text-slate-600 dark:text-slate-400 mb-2">
                    Give your room a name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Goa Trip 2026"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    autoFocus
                    required
                    className="w-full px-4 py-4 rounded-2xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/15 focus:border-[#ffda3f] text-[#060606] dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-sans font-semibold shadow-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!roomNameInput.trim() || loading}
                  className="w-full py-4 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] disabled:opacity-50 text-[#060606] font-sans font-bold text-sm tracking-wide uppercase transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95"
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
                  <label className="block text-meta text-slate-600 dark:text-slate-400 mb-2">
                    Enter 6-Character Room Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 7K92-XP"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      autoFocus
                      required
                      className="w-full py-4 pl-11 pr-4 rounded-2xl bg-[#fff9e9] dark:bg-[#0a0a0f] border border-[#e7dfcd] dark:border-white/15 focus:border-[#ffda3f] text-[#060606] dark:text-white font-mono text-center uppercase placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition text-base tracking-wider font-bold shadow-xs"
                    />
                    <Hash className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="w-full py-4 rounded-2xl bg-[#ffda3f] hover:bg-[#e6c335] disabled:opacity-50 text-[#060606] font-sans font-bold text-sm tracking-wide uppercase transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>Join Room</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* SECTION: YOUR RECENT ACTIVE ROOMS */}
        {recentRooms.length > 0 && (
          <div className="w-full mt-10 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-meta text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Your Active Rooms ({recentRooms.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {recentRooms.map((room) => (
                <div
                  key={room.code}
                  onClick={() => router.push(`/r/${room.code}`)}
                  className="group relative p-4 rounded-2xl glass-card border border-[#e7dfcd] dark:border-white/12 hover:border-[#ffda3f] cursor-pointer transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md glass-card-interactive"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#eee8d2] dark:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 flex items-center justify-center text-[#060606] dark:text-amber-400 font-extrabold shrink-0 group-hover:scale-105 transition-transform">
                      <FolderOpen className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-bold text-base text-[#060606] dark:text-white truncate">
                          {room.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-amber-400 border border-[#e7dfcd] dark:border-white/15 shrink-0">
                          #{room.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-sans font-medium">
                        {room.itemCount !== undefined && (
                          <span>{room.itemCount} {room.itemCount === 1 ? 'item' : 'items'}</span>
                        )}
                        {room.totalSize !== undefined && (
                          <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                            {formatBytes(room.totalSize)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e7dfcd]/60 dark:border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(room.code);
                      }}
                      className="p-2.5 rounded-xl text-slate-700 hover:text-[#060606] dark:text-slate-300 dark:hover:text-white bg-[#eee8d2]/70 dark:bg-[#111c36]/80 transition-all border border-transparent hover:border-[#e7dfcd]"
                      title="Copy room link"
                    >
                      {copiedCode === room.code ? (
                        <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRecentRoom(room.code);
                      }}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                      title="Remove room from list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/r/${room.code}`);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-[#ffda3f] hover:bg-[#e6c335] text-[#060606] text-xs font-sans font-bold tracking-wide uppercase transition-all shadow-md shadow-amber-500/15 flex items-center gap-1.5 active:scale-95"
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
        <div className="mt-10 text-center text-xs text-slate-600 dark:text-slate-400 font-sans font-semibold flex items-center justify-center gap-3">
          <span>DropIT • Zero Loss</span>
          <span>•</span>
          <span>Untouched Photos & Videos</span>
        </div>
      </main>
    </div>
  );
}

