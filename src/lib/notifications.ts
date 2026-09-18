// DropIT System & Service Worker Notification Helper

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function sendUploadProgressNotification(percent: number, totalFiles: number, roomName?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  const title = roomName ? `Uploading to ${roomName}` : 'Uploading Memories...';
  const body = `Progress: ${percent}% (${totalFiles} ${totalFiles === 1 ? 'file' : 'files'})`;

  // Try Service Worker registration first for background persistence
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPLOAD_PROGRESS',
      title,
      body,
      percent,
    });
  } else {
    try {
      const options: any = {
        body,
        icon: '/logo.png',
        tag: 'dropit-upload-progress',
        renotify: true,
        silent: true,
      };
      new Notification(title, options);
    } catch (e) {
      // Fallback
    }
  }
}

export function sendUploadCompleteNotification(totalFiles: number, roomName?: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  const title = '🎉 Upload Complete!';
  const body = `${totalFiles} original ${totalFiles === 1 ? 'file' : 'files'} saved untouched to ${roomName || 'DropIT'}.`;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPLOAD_COMPLETE',
      title,
      body,
    });
  } else {
    try {
      const options: any = {
        body,
        icon: '/logo.png',
        tag: 'dropit-upload-complete',
        renotify: true,
      };
      new Notification(title, options);
    } catch (e) {
      // Fallback
    }
  }
}

