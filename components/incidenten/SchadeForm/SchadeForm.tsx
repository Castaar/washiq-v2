'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PhotoUpload } from '@/components/ui/PhotoUpload/PhotoUpload';
import { Chip } from '@/components/ui/Chip/Chip';
import { Toggle } from '@/components/ui/Toggle/Toggle';
import styles from './SchadeForm.module.scss';

interface SchadeFormProps {
  siteId: string;
  userName: string;
}

export function SchadeForm({ siteId, userName }: SchadeFormProps) {
  const router = useRouter();
  const t = useTranslations('schadeForm');
  const tCommon = useTranslations('common');
  const VOERTUIG_TYPES = t.raw('voertuigTypes') as string[];
  const SCHADE_LOCATIES = t.raw('schadeLocatiesList') as string[];
  const [typeVoertuig, setTypeVoertuig] = useState(VOERTUIG_TYPES[0]);
  const [merkModel, setMerkModel] = useState('');
  const [nummerplaat, setNummerplaat] = useState('');
  const [datumUur, setDatumUur] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
  });
  const [naamEigenaar, setNaamEigenaar] = useState('');
  const [telGsm, setTelGsm] = useState('');
  const [email, setEmail] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [schadeLocaties, setSchadeLocaties] = useState<string[]>([]);
  const [onbetwist, setOnbetwist] = useState(false);
  const [installatiefout, setInstallatiefout] = useState(false);
  const [klantVerantwoordelijk, setKlantVerantwoordelijk] = useState(false);
  const [verzekeringsdocumenten, setVerzekeringsdocumenten] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleLocatie(locatie: string) {
    setSchadeLocaties((prev) =>
      prev.includes(locatie) ? prev.filter((l) => l !== locatie) : [...prev, locatie],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/incidents/schade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          type_voertuig: typeVoertuig,
          merk_model: merkModel,
          nummerplaat,
          datum_uur: datumUur,
          naam_eigenaar: naamEigenaar,
          tel_gsm: telGsm,
          email,
          omschrijving,
          schade_locaties: schadeLocaties,
          onbetwist,
          installatiefout,
          klant_verantwoordelijk: klantVerantwoordelijk,
          verzekeringsdocumenten,
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
          <label className={styles.fieldLabel}>{t('typeVoertuig')}</label>
          <select className={styles.select} value={typeVoertuig} onChange={(e) => setTypeVoertuig(e.target.value)}>
            {VOERTUIG_TYPES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('merkModel')}</label>
          <input className={styles.input} type="text" placeholder={t('merkModelPlaceholder')} value={merkModel} onChange={(e) => setMerkModel(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('nummerplaat')}</label>
          <input className={styles.input} type="text" placeholder={t('nummerplaatPlaceholder')} value={nummerplaat} onChange={(e) => setNummerplaat(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('datumUur')}</label>
          <input className={styles.input} type="datetime-local" value={datumUur} onChange={(e) => setDatumUur(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('naamEigenaar')}</label>
          <input className={styles.input} type="text" placeholder={t('naamEigenaarPlaceholder')} value={naamEigenaar} onChange={(e) => setNaamEigenaar(e.target.value)} />
        </div>
      </div>

      {/* Row 2 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('telGsm')}</label>
          <input className={styles.input} type="tel" placeholder={t('telGsmPlaceholder')} value={telGsm} onChange={(e) => setTelGsm(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('email')}</label>
          <input className={styles.input} type="email" placeholder={t('emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className={[styles.fieldGroup, styles.fieldGroupWide].join(' ')}>
          <label className={styles.fieldLabel}>{t('omschrijvingSchade')}</label>
          <textarea className={styles.textarea} placeholder={t('omschrijvingSchadePlaceholder')} value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} rows={4} />
        </div>
      </div>

      {/* Schade locaties */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{t('schadeLocaties')}</label>
        <div className={styles.chipGrid}>
          {SCHADE_LOCATIES.map((locatie) => (
            <Chip
              key={locatie}
              tone="blue"
              selected={schadeLocaties.includes(locatie)}
              onClick={() => toggleLocatie(locatie)}
            >
              {locatie}
            </Chip>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className={styles.toggleRow}>
        <Toggle label={t('onbetwist')} checked={onbetwist} onChange={setOnbetwist} />
        <Toggle label={t('installatiefout')} checked={installatiefout} onChange={setInstallatiefout} />
        <Toggle label={t('klantVerantwoordelijk')} checked={klantVerantwoordelijk} onChange={setKlantVerantwoordelijk} />
        <Toggle label={t('verzekeringsdocumenten')} checked={verzekeringsdocumenten} onChange={setVerzekeringsdocumenten} />
      </div>

      <div className={styles.photoSection}>
        <label className={styles.sectionLabel}>{t('fotos')}</label>
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
