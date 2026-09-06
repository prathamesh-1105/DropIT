'use client';

import React, { useEffect, useState } from 'react';
// @ts-ignore
import QRCode from 'qrcode';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomName: string;
  roomUrl: string;
}

export const QrModal: React.FC<QrModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  roomName,
  roomUrl,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && roomUrl) {
      QRCode.toDataURL(roomUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: unknown) => console.error('Error generating QR:', err));
    }
  }, [isOpen, roomUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${roomName} on DROP`,
          text: `Upload & download zero-loss original photos/videos in room ${roomCode}`,
          url: roomUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-2xl text-slate-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 font-extrabold mb-1">
          Scan to Join Room
        </h3>
        <h2 className="text-xl font-black mb-1 truncate px-4">
          {roomName}
        </h2>
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-5">
          Code: <span className="text-blue-600 dark:text-blue-400 font-bold">{roomCode}</span>
        </p>

        {qrDataUrl ? (
          <div className="p-3 bg-white rounded-2xl inline-block shadow-md mb-5 border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Room QR Code" className="w-56 h-56 rounded-lg" />
          </div>
        ) : (
          <div className="w-56 h-56 bg-slate-100 dark:bg-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-5 animate-pulse">
            <span className="text-xs text-slate-400 font-bold">Generating QR...</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={handleNativeShare}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-blue-500/20"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
