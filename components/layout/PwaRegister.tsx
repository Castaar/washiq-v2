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

    // Fallback for notification clicks: client.navigate() from the service
    // worker silently no-ops on several iOS/PWA versions, leaving the app on
    // whatever page it already had open instead of the notification's
    // target. The SW also postMessages us the URL — force the navigation
    // here with a real page load, which always works.
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'notification-navigate' && typeof event.data.url === 'string') {
        if (window.location.pathname + window.location.search !== event.data.url) {
          window.location.href = event.data.url;
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // iOS often resumes the frozen app on its previous screen and drops the
    // postMessage above. The service worker also stores the clicked target in
    // Cache Storage — pick it up whenever the app becomes visible again.
    async function consumePendingNavigation() {
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('glosiv-pending-nav');
        const res = await cache.match('/__pending-nav');
        if (!res) return;
        await cache.delete('/__pending-nav');
        const { url, at } = (await res.json()) as { url?: string; at?: number };
        if (typeof url !== 'string' || !url.startsWith('/')) return;
        if (!at || Date.now() - at > 5 * 60 * 1000) return;
        if (window.location.pathname + window.location.search !== url) window.location.href = url;
      } catch {
        // storage unavailable — nothing to do
      }
    }
    void consumePendingNavigation();
    function handleVisible() {
      if (document.visibilityState === 'visible') void consumePendingNavigation();
    }
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return null;
}
