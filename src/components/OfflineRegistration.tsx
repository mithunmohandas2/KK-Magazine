'use client';

import { useEffect } from 'react';

export default function OfflineRegistration() {
  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Reader navigation remains available if the browser blocks registration.
    });
  }, []);

  return null;
}
