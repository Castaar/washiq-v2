'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './IncidentenPanel.module.scss';

export interface IncidentListItem {
  id: string;
  type: 'schade' | 'ehbo' | 'defect';
  title: string;
  subtitle: string;
  date: string;
}

const TYPE_LABEL: Record<IncidentListItem['type'], string> = {
  schade: 'Schade',
  ehbo: 'EHBO',
  defect: 'Defect',
};

const ERNST_COLORS: Record<string, string> = {
  laag: 'var(--color-accent-teal)',
  medium: '#e0b344',
  hoog: '#e07844',
};

type Ernst = 'laag' | 'medium' | 'hoog';

export function IncidentenPanel({
  siteId,
  initialIncidents,
}: {
  siteId: string;
  initialIncidents: IncidentListItem[];
}) {
  const [incidents, setIncidents] = useState(initialIncidents);

  // Defect form state
  const [omschrijving, setOmschrijving] = useState('');
  const [ernst, setErnst] = useState<Ernst>('medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleDefectSave() {
    if (!omschrijving.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/incidents/defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, omschrijving, ernst }),
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
        };
        setIncidents((prev) => [newItem, ...prev]);
        setOmschrijving('');
        setErnst('medium');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const schadeHref = `/incidenten/schade?site=${siteId}`;
  const ehboHref   = `/incidenten/ehbo?site=${siteId}`;

  return (
    <div className={styles.grid}>
      {/* ── Left: incident list ────────────────────────────── */}
      <div className={styles.left}>
        <h2 className={styles.sectionTitle}>Recentie incidenten</h2>
        <div className={styles.list}>
          {incidents.length === 0 && (
            <p className={styles.empty}>Nog geen incidenten gemeld.</p>
          )}
          {incidents.map((inc) => (
            <div key={inc.id} className={styles.incidentCard}>
              <span className={[styles.incIcon, styles[`icon_${inc.type}`]].join(' ')} aria-hidden="true">
                ⚠
              </span>
              <div className={styles.incBody}>
                <div className={styles.incTop}>
                  <span className={styles.incTitle}>{inc.title}</span>
                  <span className={styles.incDate}>{inc.date}</span>
                </div>
                <span className={styles.incSubtitle}>{inc.subtitle}</span>
                <span className={[styles.incBadge, styles[`badge_${inc.type}`]].join(' ')}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  {TYPE_LABEL[inc.type]}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.reportBtns}>
          <Link href={schadeHref} className={styles.reportBtn}>Schade ongeval melden</Link>
          <Link href={ehboHref} className={styles.reportBtn}>EHBO incident melden</Link>
        </div>
      </div>

      {/* ── Right: defect form ─────────────────────────────── */}
      <div className={styles.right}>
        <h2 className={styles.sectionTitle}>Technisch defect melden</h2>
        <textarea
          className={styles.defectTextarea}
          placeholder="Korte omschrijving van het technisch probleem..."
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
          rows={6}
        />
        <div className={styles.ernstRow}>
          <span className={styles.ernstLabel}>Ernst</span>
          {(['laag', 'medium', 'hoog'] as Ernst[]).map((level) => (
            <button
              key={level}
              type="button"
              className={styles.ernstBtn}
              style={{
                borderColor: ernst === level ? ERNST_COLORS[level] : 'var(--color-border)',
                color: ernst === level ? ERNST_COLORS[level] : 'var(--color-text-muted)',
              }}
              onClick={() => setErnst(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
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
  );
}
