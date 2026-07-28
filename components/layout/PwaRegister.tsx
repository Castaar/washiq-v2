'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for a newer service worker on every load, so a deployed
        // fix doesn't stay silently masked by a previously cached version.
        registration.update().catch(() => {});
      })
      .catch((err) => console.error('SW registration failed:', err));

    // When a new service worker takes control (i.e. a new build was
    // installed and activated), reload once to pick up fresh assets
    // instead of leaving the user stuck on stale cached JS/CSS.
    let reloaded = false;
    function handleControllerChange() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
