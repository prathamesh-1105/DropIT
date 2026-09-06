'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { QrModal } from '@/components/QrModal';
import {
  ArrowRight,
  User,
  FolderPlus,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

export default function CreateRoomPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [roomName, setRoomName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [createdData, setCreatedData] = useState<{
    roomCode: string;
    roomId: string;
    roomName: string;
    creatorMemberId: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const savedName = localStorage.getItem('drop_user_name');
    if (savedName) {
      setCreatorName(savedName);
    }
  }, []);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      setStep(2);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !creatorName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName.trim(),
          creatorName: creatorName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      localStorage.setItem(`drop_member_${data.roomCode}`, data.creatorMemberId);
      localStorage.setItem(`drop_name_${data.roomCode}`, creatorName.trim());
      localStorage.setItem('drop_user_name', creatorName.trim());

      // Save to recent rooms list
      try {
        const raw = localStorage.getItem('drop_recent_rooms');
        let list = raw ? JSON.parse(raw) : [];
        list = list.filter((r: any) => r.code !== data.roomCode);
        list.unshift({ code: data.roomCode, name: data.roomName, memberId: data.creatorMemberId, visitedAt: Date.now() });
        localStorage.setItem('drop_recent_rooms', JSON.stringify(list.slice(0, 10)));
      } catch (e) {
        console.error(e);
      }

      setCreatedData(data);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const roomUrl = createdData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${createdData.roomCode}`
    : '';

  const handleCopyLink = async () => {
    if (roomUrl) {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterRoom = () => {
    if (createdData) {
      router.push(`/r/${createdData.roomCode}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors">
      <Navbar showBack />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-md mx-auto my-auto w-full animate-fadeIn">
        {step === 1 && (
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 shadow-inner">
              <FolderPlus className="w-6 h-6" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Create a Room</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Give your event or trip a name.
            </p>

            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gateway of India"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={!roomName.trim()}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 shadow-inner">
              <User className="w-6 h-6" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Your Name</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Your uploaded photos & videos will be listed under your section.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prathamesh"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none transition font-semibold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-4 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:text-slate-900 dark:hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!creatorName.trim() || loading}
                  className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && createdData && (
          <div className="w-full glass-card p-6 sm:p-8 rounded-3xl shadow-2xl text-center animate-scaleUp">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-extrabold mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Room Created</span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wide mb-1">
              {createdData.roomName}
            </h2>

            <div className="my-6 p-4 rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 border border-blue-500/30">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-extrabold block mb-1">
                Room Code
              </span>
              <span className="text-3xl font-mono font-black text-blue-600 dark:text-blue-400 tracking-wider">
                {createdData.roomCode}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                {copied ? <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Link Copied!' : 'Copy Link'}
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Show QR
              </button>
            </div>

            <button
              onClick={handleEnterRoom}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm transition shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 glow-blue"
            >
              <span>Enter Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {createdData && (
        <QrModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          roomCode={createdData.roomCode}
          roomName={createdData.roomName}
          roomUrl={roomUrl}
        />
      )}
    </div>
  );
}
