import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DropIT — Zero-Loss Shared Media Rooms',
  description: 'Original quality photo and video sharing. Nothing compressed. Byte-for-byte untouched.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased flex flex-col selection:bg-blue-500/30 selection:text-blue-300 overflow-x-hidden w-full">
        {children}
      </body>
    </html>
  );
}
