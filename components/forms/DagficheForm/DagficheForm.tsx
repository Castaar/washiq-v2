'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './DagficheForm.module.scss';

const CHECKLIST_ITEMS = [
  'Stofzuigers nagezien en ok?',
  'Chemie voorraad ok?',
  'Textiel borstels nagekeken?',
  'Wastunnel uitgespoten en nagekeken?',
  'Keuken/ bureau in orde?',
  'Vuilbakken leeggemaakt?',
  'Kassa ok / afgesloten?',
];

export interface DagficheFormProps {
  siteId: string;
  siteName: string;
  userName: string;
  totalWagens: number;
}

function buildReport(
  userName: string,
  siteName: string,
  totalWagens: number,
  items: { label: string; checked: boolean; opmerking: string }[],
): string {
  const parts = userName.trim().split(' ');
  const shortName =
    parts.length >= 2
      ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
      : userName;

  const today = new Date();
  const date = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  // Build entries for every checked item, appending opmerking if present
  const checkedEntries = items
    .filter((i) => i.checked)
    .map((i) => (i.opmerking.trim() ? `${i.label} (${i.opmerking.trim()})` : i.label));

  const checkText =
    checkedEntries.length > 0 ? ` · ${checkedEntries.join(' · ')}` : '';

  return `[Automatisch gegenereerd dagrapport: ${shortName} · ${date} · ${siteName} · ${totalWagens} wassingen${checkText}]`;
}

export function DagficheForm({ siteId, siteName, userName, totalWagens }: DagficheFormProps) {
  const router = useRouter();
  const [items, setItems] = useState(
    CHECKLIST_ITEMS.map((label) => ({ label, checked: false, opmerking: '' })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const reportRef = useRef<HTMLTextAreaElement>(null);

  const dagrapport = buildReport(userName, siteName, totalWagens, items);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/dagfiche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, items, dagrapport }),
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

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.columns}>
        {/* ── Left: checklist ──────────────────────────────── */}
        <div className={styles.left}>
          <h2 className={styles.sectionLabel}>Afsluit checklist</h2>
          <div className={styles.itemList}>
            {items.map((item, i) => (
              <div key={item.label} className={styles.checklistItem}>
                <span className={styles.itemLabel}>{item.label}</span>
                <div className={styles.itemRow}>
                  <input
                    className={styles.opmerkingInput}
                    type="text"
                    placeholder="Opmerking"
                    value={item.opmerking}
                    onChange={(e) => setOpmerking(i, e.target.value)}
                  />
                  <button
                    type="button"
                    className={[styles.checkBtn, item.checked ? styles.checkBtnActive : ''].join(' ')}
                    onClick={() => toggleChecked(i)}
                    aria-label={item.checked ? 'Gezien' : 'Markeer als gezien'}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: dagrapport ────────────────────────────── */}
        <div className={styles.right}>
          <h2 className={styles.sectionLabel}>Dagrapport</h2>
          <textarea
            ref={reportRef}
            className={styles.reportArea}
            value={dagrapport}
            readOnly
            rows={5}
          />
        </div>
      </div>

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
