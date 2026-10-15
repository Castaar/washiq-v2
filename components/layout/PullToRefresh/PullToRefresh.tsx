'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PullToRefresh.module.scss';

const THRESHOLD = 70;
const MAX_PULL = 110;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Nearest scrollable ancestor (pages scroll inside their own <main>, not the window)
function scrollParent(el: Element | null): Element | null {
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}

// The installed app (iOS/Android standalone) has no browser pull-to-refresh.
// Pulling down at the top of a page reloads it, so fresh data always shows.
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!isStandalone()) return;

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) { start.current = null; return; }
      const target = e.target as Element | null;
      // Not inside sheets/dialogs or elements that handle their own gestures
      if (target?.closest('[role="dialog"], [data-no-pull-refresh], input, textarea, select')) { start.current = null; return; }
      const sp = scrollParent(target);
      const atTop = sp ? sp.scrollTop <= 0 : window.scrollY <= 0;
      start.current = atTop ? { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false } : null;
    }

    function onMove(e: TouchEvent) {
      const s = start.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = Math.abs(e.touches[0].clientX - s.x);
      if (!s.active) {
        if (dy > 10 && dy > dx * 1.5) s.active = true;
        else if (dy < 0 || dx > 15) { start.current = null; return; }
        else return;
      }
      const distance = Math.min(MAX_PULL, Math.max(0, dy * 0.5));
      pullRef.current = distance;
      setPull(distance);
    }

    function onEnd() {
      const s = start.current;
      start.current = null;
      if (!s?.active) return;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD || refreshing;
  return (
    <div className={styles.wrap} style={{ transform: `translateY(${refreshing ? THRESHOLD : pull}px)` }} aria-hidden="true">
      <div className={[styles.bubble, ready ? styles.ready : '', refreshing ? styles.spin : ''].filter(Boolean).join(' ')}>
        ↻
      </div>
      <span className={styles.label}>{refreshing ? 'Verversen…' : ready ? 'Loslaten om te verversen' : 'Trek om te verversen'}</span>
    </div>
  );
}
