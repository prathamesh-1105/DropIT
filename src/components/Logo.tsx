'use client';

import React, { useId } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = false,
  className = '',
}) => {
  const uniqueId = useId().replace(/:/g, '_');
  const lightGradId = `cloudGradLight_${uniqueId}`;
  const darkGradId = `cloudGradDark_${uniqueId}`;

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-5xl sm:text-6xl',
  };

  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      suppressHydrationWarning
    >
      {/* Cloud + Teardrop Cutout SVG Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0 transition-transform duration-300 hover:scale-105`}>
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
          <defs>
            <linearGradient id={lightGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#71b7f4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id={darkGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          
          {/* Outer Cloud Base */}
          <path
            d="M 50 145 C 25 145 10 125 10 100 C 10 75 30 55 58 55 C 70 32 95 20 122 22 C 150 25 172 45 176 72 C 190 75 200 90 200 108 C 200 128 182 145 160 145 Z"
            fill={`url(#${lightGradId})`}
            className="dark:fill-[url(#${darkGradId})] transition-all duration-500"
            style={{
              fill: `url(#${lightGradId})`,
            }}
          />

          {/* Inner Waterdrop Cutout */}
          <path
            d="M 100 58 C 100 58 132 100 132 118 C 132 135 117.5 149 100 149 C 82.5 149 68 135 68 118 C 68 100 100 58 100 58 Z"
            fill="currentColor"
            className="text-[#fff9f1] dark:text-[#0a0a0f] transition-colors duration-500"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className={`font-display tracking-tight font-extrabold flex items-center leading-none ${textSizes[size]}`}>
            <span className="text-[#060606] dark:text-white transition-colors">Drop</span>
            <span className="text-[#2563eb] dark:text-[#38bdf8] transition-colors">It</span>
          </div>
          {showSubtitle && (
            <span className="font-mono text-[10px] sm:text-xs tracking-[0.25em] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
              Memories Together
            </span>
          )}
        </div>
      )}
    </div>
  );
};

