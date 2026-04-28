'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './PushSetup.module.scss';

const DISMISSED_KEY = 'dodane_push_dismissed';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer as ArrayBuffer;
}

async function registerSubscription() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const subJson = subscription.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
  });
}

export default function PushSetup() {
  const pathname = usePathname();
  const [state, setState] = useState<'hidden' | 'prompt'>('hidden');
  // Refs prevent duplicate banner shows / subscription calls across navigations
  const shownBanner = useRef(false);
  const registeredSub = useRef(false);

  useEffect(() => {
    // Skip on login page — user isn't authenticated yet, subscribe API will reject
    if (pathname === '/login') return;

    if (!('serviceWorker' in navigator)) return;
    if (!('Notification' in window)) return;

    // On iOS, push only works in standalone (home screen) mode — don't bother in Safari
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIos && !isStandalone) return;

    // Already granted — re-register silently once per session (keeps subscription current)
    if (Notification.permission === 'granted') {
      if (!registeredSub.current) {
        registeredSub.current = true;
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.pushManager) registerSubscription().catch(() => {});
        });
      }
      return;
    }

    // Already denied at OS level — nothing we can do
    if (Notification.permission === 'denied') return;

    // Show the banner once per app session
    if (shownBanner.current) return;
    shownBanner.current = true;

    // Check if dismissed recently (30-day cooldown)
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Number(dismissed) > Date.now()) return;
    localStorage.removeItem(DISMISSED_KEY);

    const t = setTimeout(() => setState('prompt'), 2000);
    return () => clearTimeout(t);
  }, [pathname]);

  if (state === 'hidden') return null;

  async function handleEnable() {
    setState('hidden');
    try {
      // requestPermission MUST be called here — inside a click/tap handler
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        if (reg.pushManager) {
          await registerSubscription();
        }
      }
    } catch {
      // silently ignore
    }
  }

  function handleDismiss() {
    setState('hidden');
    // Remember for 30 days, then ask again
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(expires));
  }

  return (
    <div className={styles.banner} role="alertdialog" aria-label="Meldingen inschakelen">
      <span className={styles.icon}>🔔</span>
      <div className={styles.text}>
        <p>
          <strong>Meldingen inschakelen</strong>
          Ontvang een melding bij nieuwe incidenten en defecten.
        </p>
      </div>
      <div className={styles.actions}>
        <button className={styles.enableBtn} onClick={handleEnable}>
          Inschakelen
        </button>
        <button className={styles.dismissBtn} onClick={handleDismiss} aria-label="Sluiten">
          ✕
        </button>
      </div>
    </div>
  );
}
