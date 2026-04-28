'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './SchadeForm.module.scss';

const VOERTUIG_TYPES = ['Personenwagen', 'Bestelwagen', 'Vrachtwagen', 'Motor', 'Fiets', 'Andere'];

interface SchadeFormProps {
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

export function SchadeForm({ siteId, userName }: SchadeFormProps) {
  const router = useRouter();
  const [typeVoertuig, setTypeVoertuig] = useState('Personenwagen');
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
  const [onbetwist, setOnbetwist] = useState(false);
  const [installatiefout, setInstallatiefout] = useState(false);
  const [klantVerantwoordelijk, setKlantVerantwoordelijk] = useState(false);
  const [verzekeringsdocumenten, setVerzekeringsdocumenten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
          onbetwist,
          installatiefout,
          klant_verantwoordelijk: klantVerantwoordelijk,
          verzekeringsdocumenten,
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
      <h2 className={styles.cardTitle}>Nieuw schadeongeval rapporteren</h2>

      {/* Row 1 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Type voertuig</label>
          <select className={styles.select} value={typeVoertuig} onChange={(e) => setTypeVoertuig(e.target.value)}>
            {VOERTUIG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Merk / Model</label>
          <input className={styles.input} type="text" placeholder="VW Golf" value={merkModel} onChange={(e) => setMerkModel(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Nummerplaat</label>
          <input className={styles.input} type="text" placeholder="1-ABC-234" value={nummerplaat} onChange={(e) => setNummerplaat(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Datum / Uur</label>
          <input className={styles.input} type="datetime-local" value={datumUur} onChange={(e) => setDatumUur(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Naam eigenaar</label>
          <input className={styles.input} type="text" placeholder="John D'hoe" value={naamEigenaar} onChange={(e) => setNaamEigenaar(e.target.value)} />
        </div>
      </div>

      {/* Row 2 */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Tel. / Gsm</label>
          <input className={styles.input} type="tel" placeholder="0496 123 456" value={telGsm} onChange={(e) => setTelGsm(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>E-mail</label>
          <input className={styles.input} type="email" placeholder="piet@mail.be" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className={[styles.fieldGroup, styles.fieldGroupWide].join(' ')}>
          <label className={styles.fieldLabel}>Omschrijving schade</label>
          <textarea className={styles.textarea} placeholder="Spiegel geraakt tijdens doorrijden tunnel..." value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} rows={4} />
        </div>
      </div>

      {/* Checkboxes */}
      <div className={styles.checkRow}>
        <CheckToggle label="Onbetwist?" value={onbetwist} onChange={setOnbetwist} />
        <CheckToggle label="Installatiefout?" value={installatiefout} onChange={setInstallatiefout} />
        <CheckToggle label="Klant verantwoordelijk?" value={klantVerantwoordelijk} onChange={setKlantVerantwoordelijk} />
        <CheckToggle label="Verzekeringsdocumenten" value={verzekeringsdocumenten} onChange={setVerzekeringsdocumenten} />
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
