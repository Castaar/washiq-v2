'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SeverityChips, type Severity } from '@/components/ui/Chip/Chip';
import { PhotoUpload } from '@/components/ui/PhotoUpload/PhotoUpload';
import { IncidentModal } from '@/components/dashboard/IncidentModal/IncidentModal';
import type { IncidentPayload } from '@/lib/types/dashboard';
import styles from './IncidentenPanel.module.scss';

export interface IncidentListItem {
  id: string;
  type: 'schade' | 'ehbo' | 'defect';
  title: string;
  subtitle: string;
  date: string;
  is_resolved: boolean;
  resolved_by_name: string;
  payload?: IncidentPayload;
  refType?: string;
}

export interface SchadeLocatieStat {
  locatie: string;
  count: number;
  per1000: number | null;
}

export interface IncidentStats {
  totalSchade: number;
  currentTellerstand: number;
  schadesPer1000: number | null;
  schadeLocatieStats?: SchadeLocatieStat[];
}

const TYPE_LABEL: Record<IncidentListItem['type'], string> = {
  schade: 'Schade',
  ehbo: 'EHBO',
  defect: 'Defect',
};

type Ernst = Severity;
type Filter = 'open' | 'opgelost' | 'alles';

export function IncidentenPanel({
  siteId,
  initialIncidents,
  stats,
}: {
  siteId: string;
  initialIncidents: IncidentListItem[];
  stats: IncidentStats;
}) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [filter, setFilter] = useState<Filter>('open');
  const [omschrijving, setOmschrijving] = useState('');
  const [ernst, setErnst] = useState<Ernst>('medium');
  const [defectPhotos, setDefectPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(initialIncidents.length < 45);
  const [defectFormOpen, setDefectFormOpen] = useState(false);
  const [openIncident, setOpenIncident] = useState<IncidentListItem | null>(null);

  async function handleDefectSave() {
    if (!omschrijving.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/incidents/defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, omschrijving, ernst, photos: defectPhotos }),
      });
      if (res.ok) {
        const today = new Date();
        const date = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        const newItem: IncidentListItem = {
          id: ((await res.json()) as { id: string }).id,
          type: 'defect',
          title: omschrijving.slice(0, 40),
          subtitle: ernst,
          date,
          is_resolved: false,
          resolved_by_name: '',
        };
        setIncidents((prev) => [newItem, ...prev]);
        setOmschrijving('');
        setErnst('medium');
        setDefectPhotos([]);
        setSaved(true);
        setTimeout(() => { setSaved(false); setDefectFormOpen(false); }, 1200);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleResolve(inc: IncidentListItem) {
    setResolvingId(inc.id);
    const endpoint =
      inc.type === 'defect'
        ? `/api/incidents/defect/${inc.id}`
        : `/api/incidents/schade/${inc.id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_resolved: !inc.is_resolved }),
      });
      if (res.ok) {
        setIncidents((prev) =>
          prev.map((i) => i.id === inc.id ? { ...i, is_resolved: !inc.is_resolved } : i),
        );
      }
    } finally {
      setResolvingId(null);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/incidents?siteId=${siteId}&skip=${incidents.length}`);
      if (res.ok) {
        const data = await res.json() as { items: IncidentListItem[] };
        const newItems = data.items ?? [];
        setIncidents((prev) => [...prev, ...newItems]);
        if (newItems.length < 15) setAllLoaded(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const schadeHref = `/incidenten/schade?site=${siteId}`;
  const ehboHref   = `/incidenten/ehbo?site=${siteId}`;

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'open') return !inc.is_resolved;
    if (filter === 'opgelost') return inc.is_resolved;
    return true;
  });

  const openCount = incidents.filter((i) => !i.is_resolved && (i.type === 'defect' || i.type === 'schade')).length;

  return (
    <div className={styles.wrap}>
      {openIncident?.payload && (
        <IncidentModal
          payload={openIncident.payload}
          refId={openIncident.id}
          refType={openIncident.refType ?? openIncident.type}
          siteId={siteId}
          onClose={() => setOpenIncident(null)}
        />
      )}

      {/* ── Report tabs ───────────────────────────────────────── */}
      <div className={styles.reportBtns}>
        <Link href={schadeHref} className={styles.reportBtn}>Schade</Link>
        <Link href={ehboHref} className={styles.reportBtn}>EHBO</Link>
      </div>

      {/* ── Incident list ─────────────────────────────────────── */}
      <div className={styles.listHeader}>
        <h2 className={styles.sectionTitle}>Recente incidenten</h2>
        <div className={styles.filterTabs}>
          {(['open', 'opgelost', 'alles'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={[styles.filterTab, filter === f ? styles.filterTabActive : ''].filter(Boolean).join(' ')}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.list}>
        {filteredIncidents.length === 0 && (
          <p className={styles.empty}>
            {filter === 'open' ? 'Geen openstaande incidenten.' : 'Geen incidenten gevonden.'}
          </p>
        )}
        {filteredIncidents.map((inc) => (
          <div
            key={inc.id}
            className={[styles.incidentCard, inc.is_resolved ? styles.incidentCardResolved : '', inc.payload ? styles.incidentCardClickable : ''].filter(Boolean).join(' ')}
            onClick={inc.payload ? () => setOpenIncident(inc) : undefined}
            role={inc.payload ? 'button' : undefined}
            tabIndex={inc.payload ? 0 : undefined}
          >
            <span className={[styles.incIcon, styles[`icon_${inc.type}`]].join(' ')} aria-hidden="true">⚠</span>
            <div className={styles.incBody}>
              <div className={styles.incTop}>
                <span className={styles.incTitle}>{inc.title}</span>
                <span className={styles.incDate}>{inc.date}</span>
              </div>
              <span className={styles.incSubtitle}>{inc.subtitle}</span>
              <div className={styles.incFooter}>
                <span className={[styles.incBadge, styles[`badge_${inc.type}`]].join(' ')}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  {TYPE_LABEL[inc.type]}
                </span>
                {(inc.type === 'defect' || inc.type === 'schade') && (
                  <button
                    type="button"
                    className={[styles.resolveBtn, inc.is_resolved ? styles.resolveBtnDone : ''].filter(Boolean).join(' ')}
                    onClick={(e) => { e.stopPropagation(); handleToggleResolve(inc); }}
                    disabled={resolvingId === inc.id}
                  >
                    {inc.is_resolved ? '✓ Opgelost' : 'Opgelost?'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!allLoaded && (
        <button
          type="button"
          className={styles.loadMoreBtn}
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Laden...' : 'Laad meer incidenten'}
        </button>
      )}

      {/* ── Defect quick-report (collapsible, like Dagfiche) ──── */}
      {defectFormOpen ? (
        <div className={styles.defectPanel}>
          <h2 className={styles.sectionTitle}>Technisch defect melden</h2>
          <textarea
            className={styles.defectTextarea}
            placeholder="Korte omschrijving van het technisch probleem..."
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
            rows={3}
          />
          <div className={styles.ernstRow}>
            <span className={styles.ernstLabel}>Ernst</span>
            <SeverityChips value={ernst} onChange={setErnst} />
          </div>
          <PhotoUpload photos={defectPhotos} onChange={setDefectPhotos} maxPhotos={5} />
          <div className={styles.defectFormActions}>
            <button type="button" className={styles.defectCancelBtn} onClick={() => setDefectFormOpen(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className={styles.defectSaveBtn}
              onClick={handleDefectSave}
              disabled={saving || !omschrijving.trim()}
            >
              {saved ? 'Opgeslagen ✓' : saving ? 'Bezig...' : 'Defect opslaan'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.openDefectBtn} onClick={() => setDefectFormOpen(true)}>
          + Defect melden
        </button>
      )}
    </div>
  );
}
