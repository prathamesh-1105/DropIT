// DropIT Service Worker for Background Sync & Native System Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from client to trigger native OS system notifications
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, title, body, tag, icon, percent } = event.data;

  if (type === 'UPLOAD_PROGRESS') {
    self.registration.showNotification(title || 'DropIT Uploading...', {
      body: body || `Upload progress: ${percent}%`,
      icon: icon || '/logo.png',
      tag: tag || 'dropit-upload-progress',
      renotify: true,
      silent: true,
      data: { percent },
    });
  } else if (type === 'UPLOAD_COMPLETE') {
    self.registration.showNotification(title || '🎉 Upload Complete!', {
      body: body || 'All original photos & videos saved safely.',
      icon: icon || '/logo.png',
      tag: 'dropit-upload-complete',
      renotify: true,
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
