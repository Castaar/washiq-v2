'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { AlertItem, AlertsPanelData, DagfichePayload, IncidentPayload, MaintenanceTaskPayload } from '@/lib/types/dashboard';
import { DynamicIcon, IconTrash, IconMessageSquare, IconX, IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { DagficheModal } from '@/components/dashboard/DagficheModal/DagficheModal';
import { IncidentModal } from '@/components/dashboard/IncidentModal/IncidentModal';
import { MaintenanceModal } from '@/components/dashboard/MaintenanceModal/MaintenanceModal';
import styles from './AlertsPanel.module.scss';

type AlertTab = 'alerts' | 'onderhoud' | 'incident';

const tabLabels: Record<AlertTab, string> = {
  alerts:    'Meldingen',
  onderhoud: 'Onderhoud',
  incident:  'Incidenten',
};

const tabs: AlertTab[] = ['alerts', 'onderhoud', 'incident'];

const severityLabel: Record<string, string> = {
  medium: 'Midden',
  high:   'Hoog',
  low:    'Laag',
};

// ─── Persistent dismiss via localStorage ─────────────────────
const DISMISS_KEY = 'dodane_dismissed_alerts';

function useDismissed() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) setDismissed(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { dismissed, dismiss, restore };
}

// ─── Swipeable row wrapper ────────────────────────────────────
function SwipeRow({
  id,
  onDismiss,
  children,
}: {
  id: string;
  onDismiss: (id: string) => void;
  children: React.ReactNode;
}) {
  const startXRef = useRef<number | null>(null);
  const swipeDirectionRef = useRef<1 | -1>(1);
  const [offsetX, setOffsetX] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'exiting' | 'collapsing'>('idle');
  const threshold = 90;
  const pointerIdRef = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (phase !== 'idle') return;
    startXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    if (pointerIdRef.current !== null && Math.abs(dx) > 6) {
      (e.currentTarget as HTMLElement).setPointerCapture(pointerIdRef.current);
      pointerIdRef.current = null;
    }
    setOffsetX(dx);
  }

  function finish() {
    if (startXRef.current === null) return;
    const dx = offsetX;
    startXRef.current = null;
    pointerIdRef.current = null;
    if (Math.abs(dx) >= threshold) {
      swipeDirectionRef.current = dx >= 0 ? 1 : -1;
      setOffsetX(0);
      setPhase('confirming');
    } else {
      setOffsetX(0);
    }
  }

  function confirmDismiss() {
    setPhase('exiting');
    setTimeout(() => setPhase('collapsing'), 260);
    setTimeout(() => onDismiss(id), 490);
  }

  function cancelDismiss() { setPhase('idle'); }

  const isDragging = startXRef.current !== null;
  const progress = Math.min(Math.abs(offsetX) / threshold, 1);

  const innerStyle: React.CSSProperties =
    phase === 'exiting'
      ? { transform: `translateX(${swipeDirectionRef.current >= 0 ? '110%' : '-110%'})`, opacity: 0, transition: 'transform 0.26s ease, opacity 0.2s ease' }
      : { transform: `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.25s ease' };

  return (
    <div className={[styles.swipeWrap, phase === 'collapsing' ? styles.swipeCollapsing : ''].join(' ')}>
      {phase === 'confirming' && (
        <div className={styles.confirmOverlay}>
          <span className={styles.confirmText}>Verwijderen?</span>
          <div className={styles.confirmBtns}>
            <button className={styles.confirmYes} onClick={confirmDismiss}>Ja</button>
            <button className={styles.confirmNo}  onClick={cancelDismiss}>Nee</button>
          </div>
        </div>
      )}
      <div className={styles.swipeBg} style={{ opacity: progress }}>
        <IconTrash size={14} />
      </div>
      <div
        className={styles.swipeInner}
        style={phase === 'confirming' ? { opacity: 0.3, pointerEvents: 'none' } : innerStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Alert row ───────────────────────────────────────────────
function AlertRow({
  alert,
  onClick,
  isDismissed,
  onRestore,
}: {
  alert: AlertItem;
  onClick?: () => void;
  isDismissed?: boolean;
  onRestore?: () => void;
}) {
  return (
    <div
      className={[
        styles.item,
        onClick ? styles.clickable : '',
        isDismissed ? styles.itemDismissed : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className={[styles.iconBox, styles[`icon-${alert.severity}`]].join(' ')}>
        <DynamicIcon name={alert.iconName} size={16} />
      </span>
      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemTitle}>{alert.title}</span>
          <div className={styles.itemTopRight}>
            {alert.date && <span className={styles.itemDate}>{alert.date}</span>}
            {alert.refType && !isDismissed && (
              <IconMessageSquare size={11} className={styles.commentHint} aria-label="Reacties beschikbaar" />
            )}
            {isDismissed && onRestore && (
              <button
                className={styles.restoreBtn}
                onClick={(e) => { e.stopPropagation(); onRestore(); }}
                aria-label="Herstellen"
                title="Herstellen"
              >
                ↩
              </button>
            )}
          </div>
        </div>
        {alert.subtitle && <span className={styles.itemSubtitle}>{alert.subtitle}</span>}
        <span className={[styles.severity, styles[`sev-${alert.severity}`]].join(' ')}>
          <span className={styles.sevDot} aria-hidden="true" />
          {severityLabel[alert.severity]}
        </span>
      </div>
    </div>
  );
}

// ─── Archive popup ────────────────────────────────────────────
function ArchivePopup({
  tab,
  items,
  dismissed,
  onRestore,
  onItemClick,
  onClose,
}: {
  tab: AlertTab;
  items: AlertItem[];
  dismissed: Set<string>;
  onRestore: (id: string) => void;
  onItemClick: (alert: AlertItem) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dismissedCount = items.filter((a) => dismissed.has(a.id)).length;

  return (
    <div className={styles.archiveOverlay} onClick={onClose}>
      <div className={styles.archiveModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.archiveHeader}>
          <div>
            <h2 className={styles.archiveTitle}>{tabLabels[tab]}</h2>
            <p className={styles.archiveMeta}>
              {items.length} items totaal
              {dismissedCount > 0 && <> · {dismissedCount} verwijderd</>}
            </p>
          </div>
          <button className={styles.archiveClose} onClick={onClose} aria-label="Sluiten">
            <IconX size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className={styles.archiveBody}>
          {items.length === 0 ? (
            <p className={styles.archiveEmpty}>Geen items</p>
          ) : (
            items.map((alert) => {
              const wasDismissed = dismissed.has(alert.id);
              return (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  isDismissed={wasDismissed}
                  onRestore={wasDismissed ? () => onRestore(alert.id) : undefined}
                  onClick={alert.payload ? () => onItemClick(alert) : undefined}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal state types ────────────────────────────────────────
type DagficheModalState     = { payload: DagfichePayload; refId: string; refType: string; siteId: string };
type IncidentModalState     = { payload: IncidentPayload; refId: string; refType: string; siteId: string };
type MaintenanceModalState  = { payload: MaintenanceTaskPayload; refId: string; refType: string; siteId: string };

// ─── Panel ───────────────────────────────────────────────────
interface DayLog {
  label: string;
  isToday: boolean;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}

interface AlertsPanelProps {
  data: AlertsPanelData;
  dayLog?: DayLog;
}

export function AlertsPanel({ data, dayLog }: AlertsPanelProps) {
  const [active, setActive]               = useState<AlertTab>('alerts');
  const [archiveOpen, setArchiveOpen]     = useState(false);
  const [dagficheOpen, setDagficheOpen]   = useState<DagficheModalState | null>(null);
  const [incidentOpen, setIncidentOpen]   = useState<IncidentModalState | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState<MaintenanceModalState | null>(null);
  const { dismissed, dismiss, restore } = useDismissed();

  const allItems    = data[active];
  const activeItems = allItems.filter((a) => !dismissed.has(a.id));
  const dismissedCount = allItems.length - activeItems.length;

  function switchTab(tab: AlertTab) {
    setActive(tab);
    setArchiveOpen(false);
  }

  function handleAlertClick(alert: AlertItem) {
    if (!alert.payload) return;
    const refId   = alert.refId  ?? alert.id;
    const refType = alert.refType ?? '';
    const siteId  = alert.siteId  ?? '';
    if (alert.payload.type === 'dagfiche') {
      setDagficheOpen({ payload: alert.payload as DagfichePayload, refId, refType, siteId });
    } else if (alert.payload.type === 'maintenance_task') {
      setMaintenanceOpen({ payload: alert.payload as MaintenanceTaskPayload, refId, refType, siteId });
    } else {
      setIncidentOpen({ payload: alert.payload as IncidentPayload, refId, refType, siteId });
    }
  }

  return (
    <>
      {/* ── Detail modals ────────────────────────────────── */}
      {dagficheOpen && (
        <DagficheModal
          payload={dagficheOpen.payload}
          refId={dagficheOpen.refId}
          refType={dagficheOpen.refType}
          siteId={dagficheOpen.siteId}
          onClose={() => setDagficheOpen(null)}
        />
      )}
      {incidentOpen && (
        <IncidentModal
          payload={incidentOpen.payload}
          refId={incidentOpen.refId}
          refType={incidentOpen.refType}
          siteId={incidentOpen.siteId}
          onClose={() => setIncidentOpen(null)}
        />
      )}
      {maintenanceOpen && (
        <MaintenanceModal
          payload={maintenanceOpen.payload}
          refId={maintenanceOpen.refId}
          refType={maintenanceOpen.refType}
          siteId={maintenanceOpen.siteId}
          onClose={() => setMaintenanceOpen(null)}
        />
      )}

      {/* ── Archive popup ─────────────────────────────────── */}
      {archiveOpen && (
        <ArchivePopup
          tab={active}
          items={allItems}
          dismissed={dismissed}
          onRestore={restore}
          onItemClick={handleAlertClick}
          onClose={() => setArchiveOpen(false)}
        />
      )}

      <div className={styles.panel}>
        {/* ── Day switcher (Meldingen tab only) ────────────── */}
        {dayLog && active === 'alerts' && (
          <div className={styles.daySwitcher}>
            <Link href={dayLog.prevHref} className={styles.dayNavBtn} aria-label="Vorige dag">
              <IconChevronLeft size={16} />
            </Link>
            {dayLog.isToday ? (
              <span className={styles.dayLabel}>Vandaag · {dayLog.label}</span>
            ) : (
              <Link href={dayLog.todayHref} className={styles.dayLabelLink}>{dayLog.label}</Link>
            )}
            <Link href={dayLog.nextHref} className={styles.dayNavBtn} aria-label="Volgende dag">
              <IconChevronRight size={16} />
            </Link>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className={styles.tabs} role="tablist">
          {tabs.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={active === tab}
              className={[styles.tab, active === tab ? styles.activeTab : ''].filter(Boolean).join(' ')}
              onClick={() => switchTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* ── Active list ──────────────────────────────────── */}
        <div className={styles.list} role="tabpanel">
          {activeItems.length > 0
            ? activeItems.map(alert => (
                <SwipeRow key={alert.id} id={alert.id} onDismiss={dismiss}>
                  <AlertRow
                    alert={alert}
                    onClick={alert.payload ? () => handleAlertClick(alert) : undefined}
                  />
                </SwipeRow>
              ))
            : <p className={styles.empty}>Geen items</p>
          }
        </div>

        {/* ── Archive link ─────────────────────────────────── */}
        {allItems.length > 0 && (
          <button className={styles.archiveLink} onClick={() => setArchiveOpen(true)}>
            {dismissedCount > 0
              ? `${dismissedCount} verwijderd · Toon alles (${allItems.length})`
              : `Toon alle ${allItems.length} items`
            }
          </button>
        )}
      </div>
    </>
  );
}
