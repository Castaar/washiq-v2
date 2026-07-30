'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SeverityChips, type Severity } from '@/components/ui/Chip/Chip';
import { PhotoUpload } from '@/components/ui/PhotoUpload/PhotoUpload';
import styles from './DagficheForm.module.scss';

const CHECKLIST_ITEMS = [
  'Stofzuigers nagezien en ok?',
  'Chemie voorraad ok?',
  'Textiel borstels nagekeken?',
  'Wastunnel uitgespoten en nagekeken?',
  'Selfboxen nagekeken en ok?',
  'Keuken / bureau in orde?',
  'Vuilbakken leeggemaakt?',
  'Kassa ok / afgesloten?',
];

export interface TodayEvent {
  kind: 'inlog' | 'uitlog' | 'incident' | 'defect' | 'levering' | 'onderhoud';
  label: string;
  time: string;
  detail?: string;
}

export interface DagficheFormProps {
  siteId: string;
  siteName: string;
  userName: string;
  totalWagens: number;
  maintenanceTasks?: { id: string; description: string }[];
  todayEvents?: TodayEvent[];
}

function buildReport(
  userName: string,
  siteName: string,
  totalWagens: number,
  items: { label: string; checked: boolean; opmerking: string }[],
  maintenanceTasks: { id: string; description: string }[],
  maintenanceChecks: Record<string, { checked: boolean; opmerking: string }>,
): string {
  const parts = userName.trim().split(' ');
  const shortName =
    parts.length >= 2
      ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
      : userName;

  const today = new Date();
  const date = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  const checkedEntries = items
    .filter((i) => i.checked)
    .map((i) => (i.opmerking.trim() ? `${i.label} (${i.opmerking.trim()})` : i.label));

  const checkedMaintenance = maintenanceTasks
    .filter((t) => maintenanceChecks[t.id]?.checked)
    .map((t) => {
      const note = maintenanceChecks[t.id]?.opmerking?.trim();
      return note ? `${t.description} (${note})` : t.description;
    });

  const allEntries = [...checkedEntries, ...checkedMaintenance];
  const checkText = allEntries.length > 0 ? ` · ${allEntries.join(' · ')}` : '';

  return `[Automatisch gegenereerd dagrapport: ${shortName} · ${date} · ${siteName} · ${totalWagens} wassingen${checkText}]`;
}

export function DagficheForm({ siteId, siteName, userName, totalWagens, maintenanceTasks = [], todayEvents = [] }: DagficheFormProps) {
  const router = useRouter();
  const [items, setItems] = useState(
    CHECKLIST_ITEMS.map((label) => ({ label, checked: false, opmerking: '' })),
  );
  const [maintenanceChecks, setMaintenanceChecks] = useState<Record<string, { checked: boolean; opmerking: string }>>(
    Object.fromEntries(maintenanceTasks.map((t) => [t.id, { checked: false, opmerking: '' }])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const reportRef = useRef<HTMLTextAreaElement>(null);

  const [showDefect, setShowDefect] = useState(false);
  const [defectOmschrijving, setDefectOmschrijving] = useState('');
  const [defectErnst, setDefectErnst] = useState<Severity>('medium');
  const [defectPhotos, setDefectPhotos] = useState<string[]>([]);
  const [defectSubmitting, setDefectSubmitting] = useState(false);
  const [defectSubmitted, setDefectSubmitted] = useState(false);

  async function handleDefectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!defectOmschrijving.trim()) return;
    setDefectSubmitting(true);
    try {
      await fetch('/api/incidents/defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, omschrijving: defectOmschrijving.trim(), ernst: defectErnst, photos: defectPhotos }),
      });
      setDefectSubmitted(true);
      setDefectOmschrijving('');
      setDefectPhotos([]);
      setTimeout(() => { setDefectSubmitted(false); setShowDefect(false); }, 1500);
    } finally {
      setDefectSubmitting(false);
    }
  }

  const dagrapport = buildReport(userName, siteName, totalWagens, items, maintenanceTasks, maintenanceChecks);

  // Auto-resize the textarea to fit its content
  useEffect(() => {
    if (reportRef.current) {
      reportRef.current.style.height = 'auto';
      reportRef.current.style.height = `${reportRef.current.scrollHeight}px`;
    }
  }, [dagrapport]);

  function toggleChecked(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  }

  function setOpmerking(index: number, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, opmerking: value } : item)),
    );
  }

  function toggleMaintenance(id: string) {
    setMaintenanceChecks((prev) => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
  }

  function setMaintenanceOpmerking(id: string, value: string) {
    setMaintenanceChecks((prev) => ({ ...prev, [id]: { ...prev[id], opmerking: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const checkedMaintenance = Object.entries(maintenanceChecks)
      .filter(([, { checked }]) => checked)
      .map(([taskId, { opmerking }]) => ({ taskId, notes: opmerking.trim() }));
    try {
      await fetch('/api/dagfiche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          items,
          dagrapport,
          maintenanceChecks: checkedMaintenance,
          totalWagens,
        }),
      });
      setSubmitted(true);
      setTimeout(() => router.push('/'), 1200);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.card}>
        <p className={styles.success}>Dagfiche verstuurd ✓</p>
      </div>
    );
  }

  const reportedDefects = todayEvents.filter((ev) => ev.kind === 'defect');

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dagfiche</h1>
          <p className={styles.subline}>{siteName}</p>
        </div>
        <div className={styles.washCount}>
          <span className={styles.washCountValue}>{totalWagens}</span>
          <span className={styles.washCountLabel}>wassen vandaag</span>
        </div>
      </div>

      {/* ── Checklist ────────────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionLabel}>
          Controlepunten ({items.filter((i) => i.checked).length}/{items.length})
        </h2>
        <div className={styles.itemList}>
          {items.map((item, i) => (
            <div key={item.label} className={styles.checklistItem}>
              <button
                type="button"
                className={[styles.checkBtn, item.checked ? styles.checkBtnActive : ''].join(' ')}
                onClick={() => toggleChecked(i)}
                aria-label={item.checked ? 'Gezien' : 'Markeer als gezien'}
              >
                ✓
              </button>
              <span className={styles.itemLabel}>{item.label}</span>
              <input
                className={styles.opmerkingInput}
                type="text"
                placeholder="Opmerking toevoegen..."
                value={item.opmerking}
                onChange={(e) => setOpmerking(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Onderhoud vandaag ────────────────────────────── */}
      {maintenanceTasks.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Onderhoud vandaag</h2>
          <div className={styles.itemList}>
            {maintenanceTasks.map((task) => (
              <div key={task.id} className={styles.checklistItem}>
                <button
                  type="button"
                  className={[styles.checkBtn, maintenanceChecks[task.id]?.checked ? styles.checkBtnActive : ''].join(' ')}
                  onClick={() => toggleMaintenance(task.id)}
                  aria-label={maintenanceChecks[task.id]?.checked ? 'Uitgevoerd' : 'Markeer als uitgevoerd'}
                >
                  ✓
                </button>
                <span className={styles.itemLabel}>{task.description}</span>
                <input
                  className={styles.opmerkingInput}
                  type="text"
                  placeholder="Opmerking toevoegen..."
                  value={maintenanceChecks[task.id]?.opmerking ?? ''}
                  onChange={(e) => setMaintenanceOpmerking(task.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gemelde defecten ─────────────────────────────── */}
      {reportedDefects.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Gemelde defecten</h2>
          <div className={styles.itemList}>
            {reportedDefects.map((ev, i) => (
              <div key={i} className={styles.defectRow}>
                <span className={styles.defectDesc}>{ev.label}</span>
                {ev.detail && <span className={styles.defectDetail}>{ev.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Defect quick-report (collapsible) ────────────── */}
      {showDefect ? (
        <div className={styles.defectPanel}>
          {defectSubmitted ? (
            <p className={styles.defectSuccess}>Defect gemeld ✓</p>
          ) : (
            <form onSubmit={handleDefectSubmit} noValidate className={styles.defectForm}>
              <h2 className={styles.sectionLabel}>Defect melden</h2>
              <textarea
                className={styles.defectTextarea}
                placeholder="Omschrijf het defect..."
                value={defectOmschrijving}
                onChange={(e) => setDefectOmschrijving(e.target.value)}
                rows={2}
              />
              <SeverityChips value={defectErnst} onChange={setDefectErnst} />
              <PhotoUpload photos={defectPhotos} onChange={setDefectPhotos} maxPhotos={5} />
              <div className={styles.defectFormActions}>
                <button type="button" className={styles.cancelSmallBtn} onClick={() => setShowDefect(false)}>
                  Annuleer
                </button>
                <button type="submit" className={styles.defectSubmitBtn} disabled={defectSubmitting || !defectOmschrijving.trim()}>
                  {defectSubmitting ? 'Bezig...' : 'Melden'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <button type="button" className={styles.openDefectBtn} onClick={() => setShowDefect(true)}>
          + Defect melden
        </button>
      )}

      {/* ── Dagrapport (auto-gegenereerd) ─────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionLabel}>Dagrapport</h2>
        <textarea
          ref={reportRef}
          className={styles.reportArea}
          value={dagrapport}
          readOnly
          rows={3}
        />
      </div>

      {/* ── Gebeurtenissen vandaag (timeline) ─────────────── */}
      {todayEvents.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionLabel}>Gebeurtenissen vandaag</h2>
          <div className={styles.timeline}>
            {todayEvents.map((ev, i) => (
              <div key={i} className={styles.timelineRow}>
                <div className={styles.timelineRail}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  {i < todayEvents.length - 1 && <span className={styles.timelineLine} aria-hidden="true" />}
                </div>
                <div className={styles.timelineBody}>
                  <span className={styles.timelineTime}>{ev.time}</span>
                  <span className={styles.timelineLabel}>{ev.label}</span>
                  {ev.detail && <span className={styles.timelineDetail}>{ev.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <Link href={`/incidenten?site=${siteId}`} className={styles.incidentBtn}>
          Incidenten melden
        </Link>
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Bezig...' : 'Verzenden'}
        </button>
      </div>
    </form>
  );
}
