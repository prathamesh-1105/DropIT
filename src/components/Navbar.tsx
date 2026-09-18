'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Share2, QrCode, ArrowLeft, Sun, Moon } from 'lucide-react';
import { Logo } from '@/components/Logo';


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
    const applyThemeChange = () => {
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

    if (typeof window !== 'undefined') {
      const doc = document as any;
      if (typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(() => {
          applyThemeChange();
        });
      } else {
        document.body.classList.add('theme-fading');
        applyThemeChange();
        setTimeout(() => {
          document.body.classList.remove('theme-fading');
        }, 500);
      }
    } else {
      applyThemeChange();
    }
  };



  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e7dfcd] dark:border-white/10 bg-[#fff9f1]/85 dark:bg-[#0a0a0f]/85 backdrop-blur-xl px-4 py-3.5 transition-colors duration-500">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              href="/"
              className="p-2.5 rounded-2xl text-[#060606] dark:text-slate-200 hover:bg-[#eee8d2] dark:hover:bg-[#111c36] transition-all flex items-center justify-center border border-transparent hover:border-[#e7dfcd] dark:hover:border-white/10"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          <Link href="/" className="flex items-center gap-3 group">
            <Logo size="sm" showSubtitle={false} />
          </Link>


          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-meta bg-[#eee8d2] dark:bg-[#111c36] text-[#060606] dark:text-slate-200 border border-[#e7dfcd] dark:border-white/15">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Original Quality
          </span>
        </div>

        <div className="flex items-center gap-2">
          {roomName && roomCode && (
            <div className="hidden md:flex flex-col text-right mr-2">
              <span className="font-sans font-bold text-xs text-[#060606] dark:text-white uppercase tracking-wider">
                {roomName}
              </span>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                #{roomCode}
              </span>
            </div>
          )}

          {onOpenQr && (
            <button
              onClick={onOpenQr}
              className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-2xl text-[#060606] dark:text-slate-200 bg-[#eee8d2]/70 dark:bg-[#111c36]/80 border border-[#e7dfcd] dark:border-white/15 hover:bg-[#eee8d2] dark:hover:bg-[#111c36] transition-all flex items-center gap-2 text-xs font-bold shadow-xs active:scale-95"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline font-sans">QR Code</span>
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl text-[#060606] bg-[#ffda3f] hover:bg-[#e6c335] transition-all flex items-center gap-2 text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 font-sans"
              title="Share Room Link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* DAY ☀️ ↔ NIGHT 🌙 Mode Toggle (ZainabKabira Atmosphere Dissolve Trigger) */}
          <button
            onClick={toggleTheme}
            className="relative w-10 h-10 rounded-full bg-[#eee8d2] dark:bg-[#111c36] border border-[#e7dfcd] dark:border-white/15 hover:scale-105 active:scale-95 transition-all shadow-xs overflow-hidden flex items-center justify-center group"
            title={isDark ? 'Switch to DAY Mode ☀️' : 'Switch to NIGHT Mode 🌙'}
          >
            {/* Sun Icon (Day) */}
            <Sun
              className={`absolute w-5 h-5 text-amber-600 toggle-ico-sun ${
                isDark ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'
              }`}
            />
            {/* Moon Icon (Night) */}
            <Moon
              className={`absolute w-5 h-5 text-slate-100 toggle-ico-moon ${
                isDark ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

