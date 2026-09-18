'use client';

import React from 'react';
import { UploadProvider } from '@/context/UploadContext';
import { FloatingUploadWidget } from '@/components/FloatingUploadWidget';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      {children}
      <FloatingUploadWidget />
    </UploadProvider>
  );
}
