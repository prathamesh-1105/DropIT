'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Share2, QrCode, ArrowLeft, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  roomName?: string;
  roomCode?: string;
  onOpenQr?: () => void;
  onShare?: () => void;
  showBack?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomName,
  roomCode,
  onOpenQr,
  onShare,
  showBack = false,
}) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('drop_theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
      localStorage.setItem('drop_theme', 'light');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('drop_theme', 'dark');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl px-4 py-3 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="DropIT Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform"
            />
            <span className="font-display font-extrabold text-xl tracking-wide text-slate-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              DropIT
            </span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero-Loss
          </span>
        </div>

        <div className="flex items-center gap-2">
          {roomName && roomCode && (
            <div className="hidden md:flex flex-col text-right mr-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                {roomName}
              </span>
              <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                {roomCode}
              </span>
            </div>
          )}

          {onOpenQr && (
            <button
              onClick={onOpenQr}
              className="p-2.5 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">QR</span>
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="p-2.5 rounded-xl text-white bg-blue-600 hover:bg-blue-500 transition flex items-center gap-1.5 text-xs font-bold shadow-md shadow-blue-500/20"
              title="Share Room Link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
