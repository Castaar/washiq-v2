'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PhotoUpload } from '@/components/ui/PhotoUpload/PhotoUpload';
import { Toggle } from '@/components/ui/Toggle/Toggle';
import styles from './EhboForm.module.scss';

interface EhboFormProps {
  siteId: string;
  userName: string;
}

export function EhboForm({ siteId, userName }: EhboFormProps) {
  const router = useRouter();
  const t = useTranslations('ehboForm');
  const tCommon = useTranslations('common');
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
  const [photos, setPhotos] = useState<string[]>([]);
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
          photos,
        }),
      });
      if (!res.ok) { setError(t('opslaanMislukt')); return; }
      router.push(`/incidenten?site=${siteId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.cardTitle}>{t('titel')}</h2>

      {/* Row 1 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('datum')}</label>
          <input className={styles.input} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('uur')}</label>
          <input className={styles.input} type="time" value={uur} onChange={(e) => setUur(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('naamSlachtoffer')}</label>
          <input className={styles.input} type="text" placeholder={t('naamSlachtofferPlaceholder')} value={naamSlachtoffer} onChange={(e) => setNaamSlachtoffer(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('afdelingLocatie')}</label>
          <input className={styles.input} type="text" placeholder={t('afdelingLocatiePlaceholder')} value={afdelingLocatie} onChange={(e) => setAfdelingLocatie(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('verwonding')}</label>
          <input className={styles.input} type="text" placeholder={t('verwondingPlaceholder')} value={verwonding} onChange={(e) => setVerwonding(e.target.value)} />
        </div>
      </div>

      {/* Row 2 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('ehboHandeling')}</label>
          <input className={styles.input} type="text" placeholder={t('ehboHandelingPlaceholder')} value={ehboHandeling} onChange={(e) => setEhboHandeling(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('ehboVerlener')}</label>
          <input className={styles.input} type="text" placeholder={t('ehboVerlenerPlaceholder')} value={ehboVerlener} onChange={(e) => setEhboVerlener(e.target.value)} />
        </div>
        <div className={[styles.fieldGroup, styles.fieldGroupWide].join(' ')}>
          <label className={styles.fieldLabel}>{t('beschrijvingOngeval')}</label>
          <textarea className={styles.textarea} placeholder="..." value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} rows={4} />
        </div>
      </div>

      {/* Toggle */}
      <div className={styles.checkRow}>
        <Toggle label={t('dokterNodig')} checked={dokterNodig} onChange={setDokterNodig} />
      </div>

      <div className={styles.checkRow}>
        <label className={styles.fieldLabel}>{t('fotos')}</label>
        <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={5} />
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaText}>{t.rich('geregistreerdDoor', { name: userName, b: (chunks) => <strong>{chunks}</strong> })}</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? tCommon('bezig') : t('melden')}
        </button>
      </div>
    </form>
  );
}
