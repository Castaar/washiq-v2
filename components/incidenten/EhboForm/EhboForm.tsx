'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './EhboForm.module.scss';

interface EhboFormProps {
  siteId: string;
  userName: string;
}

function CheckToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.toggleGroup}>
      <span className={styles.toggleLabel}>{label}</span>
      <button
        type="button"
        className={[styles.toggleBtn, value ? styles.toggleActive : ''].join(' ')}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        ✓
      </button>
    </div>
  );
}

export function EhboForm({ siteId, userName }: EhboFormProps) {
  const router = useRouter();
  const now = new Date();
  const [datum, setDatum] = useState(now.toISOString().slice(0, 10));
  const [uur, setUur] = useState(now.toTimeString().slice(0, 5));
  const [naamSlachtoffer, setNaamSlachtoffer] = useState('');
  const [afdelingLocatie, setAfdelingLocatie] = useState('');
  const [verwonding, setVerwonding] = useState('');
  const [ehboHandeling, setEhboHandeling] = useState('');
  const [ehboVerlener, setEhboVerlener] = useState('');
  const [beschrijving, setBeschrijving] = useState('');
  const [dokterNodig, setDokterNodig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/incidents/ehbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          datum,
          uur,
          naam_slachtoffer: naamSlachtoffer,
          afdeling_locatie: afdelingLocatie,
          verwonding,
          ehbo_handeling: ehboHandeling,
          ehbo_verlener: ehboVerlener,
          beschrijving,
          dokter_nodig: dokterNodig,
        }),
      });
      if (!res.ok) { setError('Opslaan mislukt'); return; }
      router.push(`/incidenten?site=${siteId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.cardTitle}>Nieuw EHBO incident rapporteren</h2>

      {/* Row 1 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Datum</label>
          <input className={styles.input} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Uur</label>
          <input className={styles.input} type="time" value={uur} onChange={(e) => setUur(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Naam slachtoffer</label>
          <input className={styles.input} type="text" placeholder="Jan Janssen" value={naamSlachtoffer} onChange={(e) => setNaamSlachtoffer(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Afdeling / locatie</label>
          <input className={styles.input} type="text" placeholder="Ingang tunnel" value={afdelingLocatie} onChange={(e) => setAfdelingLocatie(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Verwonding</label>
          <input className={styles.input} type="text" placeholder="Snijwonde hand" value={verwonding} onChange={(e) => setVerwonding(e.target.value)} />
        </div>
      </div>

      {/* Row 2 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>EHBO handeling</label>
          <input className={styles.input} type="text" placeholder="Wonde gereinigd" value={ehboHandeling} onChange={(e) => setEhboHandeling(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>EHBO-verlener</label>
          <input className={styles.input} type="text" placeholder="Naam verlener" value={ehboVerlener} onChange={(e) => setEhboVerlener(e.target.value)} />
        </div>
        <div className={[styles.fieldGroup, styles.fieldGroupWide].join(' ')}>
          <label className={styles.fieldLabel}>Beschrijving ongeval</label>
          <textarea className={styles.textarea} placeholder="..." value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} rows={4} />
        </div>
      </div>

      {/* Checkbox */}
      <div className={styles.checkRow}>
        <CheckToggle label="Dokter nodig?" value={dokterNodig} onChange={setDokterNodig} />
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaText}>Geregistreerd door: <strong>{userName}</strong></span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'Bezig...' : 'Melden'}
        </button>
      </div>
    </form>
  );
}
