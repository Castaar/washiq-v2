'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { IncidentPayload } from '@/lib/types/dashboard';
import { ActivitySection } from '@/components/dashboard/ActivitySection/ActivitySection';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import styles from './IncidentModal.module.scss';

interface IncidentModalProps {
  payload: IncidentPayload;
  refId: string;
  refType: string;
  siteId: string;
  onClose: () => void;
}

function Row({ label, value, jaNee }: { label: string; value: string | boolean | undefined; jaNee: { ja: string; nee: string } }) {
  if (!value && value !== false) return null;
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>
        {typeof value === 'boolean' ? (value ? jaNee.ja : jaNee.nee) : value}
      </span>
    </div>
  );
}

function BoolRow({ label, value, jaNee }: { label: string; value: boolean; jaNee: { ja: string; nee: string } }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={[styles.rowValue, value ? styles.yes : styles.no].join(' ')}>
        {value ? jaNee.ja : jaNee.nee}
      </span>
    </div>
  );
}

export function IncidentModal({ payload, refId, refType, siteId, onClose }: IncidentModalProps) {
  const t = useTranslations('modals');
  const tAlerts = useTranslations('alerts');
  const router = useRouter();
  const jaNee = { ja: tAlerts('ja'), nee: tAlerts('nee') };
  const typeLabels: Record<string, string> = { schade: t('typeSchade'), ehbo: t('typeEhbo'), defect: t('typeDefect') };
  const ernstLabels: Record<string, string> = { laag: t('ernstLaag'), medium: t('ernstMedium'), hoog: t('ernstHoog') };
  const typeLabel = typeLabels[payload.type] ?? payload.type;

  const canResolve = payload.type === 'schade' || payload.type === 'defect' || payload.type === 'ehbo';
  const [isResolved, setIsResolved] = useState(canResolve ? Boolean(payload.isResolved) : false);
  const [resolving, setResolving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const photos = payload.photos ?? [];

  // Schade reports can be edited in place — e.g. to correct a report that
  // was originally logged at the wrong site or with the wrong details.
  const canEdit = true;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => payload.type === 'schade' ? {
    typeVoertuig: payload.typeVoertuig,
    merkModel: payload.merkModel,
    nummerplaat: payload.nummerplaat,
    naamEigenaar: payload.naamEigenaar,
    telGsm: payload.telGsm,
    email: payload.email,
    omschrijving: payload.omschrijving,
    onbetwist: payload.onbetwist,
    installatiefout: payload.installatiefout,
    klantVerantwoordelijk: payload.klantVerantwoordelijk,
    verzekeringsdocumenten: payload.verzekeringsdocumenten,
  } : null);

  const [defectDraft, setDefectDraft] = useState(() => payload.type === 'defect'
    ? { omschrijving: payload.omschrijving, ernst: payload.ernst } : null);
  const [ehboDraft, setEhboDraft] = useState(() => payload.type === 'ehbo'
    ? { naamSlachtoffer: payload.naamSlachtoffer, verwonding: payload.verwonding, beschrijving: payload.beschrijving } : null);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('bevestigVerwijderen'))) return;
    setDeleting(true);
    setActionError('');
    try {
      const endpoint = payload.type === 'defect'
        ? `/api/incidents/defect/${refId}`
        : payload.type === 'ehbo'
          ? `/api/incidents/ehbo/${refId}`
          : `/api/incidents/schade/${refId}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setActionError(res.status === 403 ? t('enkelMelderOfBeheerder') : t('actieMislukt'));
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveEdit() {
    setActionError('');
    if (payload.type === 'defect' || payload.type === 'ehbo') {
      const endpoint = payload.type === 'defect' ? `/api/incidents/defect/${refId}` : `/api/incidents/ehbo/${refId}`;
      const body = payload.type === 'defect'
        ? { omschrijving: defectDraft?.omschrijving ?? '', ernst: defectDraft?.ernst }
        : { naam_slachtoffer: ehboDraft?.naamSlachtoffer ?? '', verwonding: ehboDraft?.verwonding ?? '', beschrijving: ehboDraft?.beschrijving ?? '' };
      setSaving(true);
      try {
        const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
          setEditing(false);
          router.refresh();
        } else {
          setActionError(res.status === 403 ? t('enkelMelderOfBeheerder') : t('actieMislukt'));
        }
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/schade/${refId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_voertuig: draft.typeVoertuig,
          merk_model: draft.merkModel,
          nummerplaat: draft.nummerplaat,
          naam_eigenaar: draft.naamEigenaar,
          tel_gsm: draft.telGsm,
          email: draft.email,
          omschrijving: draft.omschrijving,
          onbetwist: draft.onbetwist,
          installatiefout: draft.installatiefout,
          klant_verantwoordelijk: draft.klantVerantwoordelijk,
          verzekeringsdocumenten: draft.verzekeringsdocumenten,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleResolve() {
    if (!canResolve) return;
    setResolving(true);
    try {
      const endpoint = payload.type === 'defect'
        ? `/api/incidents/defect/${refId}`
        : payload.type === 'ehbo'
          ? `/api/incidents/ehbo/${refId}`
          : `/api/incidents/schade/${refId}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_resolved: !isResolved }),
      });
      if (res.ok) {
        setIsResolved((v) => !v);
        router.refresh();
      }
    } finally {
      setResolving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={typeLabel}>
      <div className={styles.headerTop}>
        <span className={[styles.badge, styles[`badge-${payload.type}`]].join(' ')}>{typeLabel}</span>
        <div className={styles.headerActions}>
          {canEdit && !editing && (
            <button type="button" className={styles.resolveBtn} onClick={() => setEditing(true)}>
              {t('bewerken')}
            </button>
          )}
          {canEdit && editing && (
            <>
              <button type="button" className={styles.resolveBtn} onClick={() => setEditing(false)} disabled={saving}>
                {t('annuleren')}
              </button>
              <button type="button" className={styles.resolveBtnDone} onClick={handleSaveEdit} disabled={saving}>
                {saving ? '...' : t('opslaan')}
              </button>
            </>
          )}
          {canResolve && (
            <button
              type="button"
              className={[styles.resolveBtn, isResolved ? styles.resolveBtnDone : ''].filter(Boolean).join(' ')}
              onClick={handleToggleResolve}
              disabled={resolving}
            >
              {isResolved ? t('opgelost') : resolving ? '...' : t('markeerOpgelost')}
            </button>
          )}
          {!editing && (
            <button type="button" className={styles.resolveBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? '...' : t('verwijderen')}
            </button>
          )}
        </div>
      </div>
      {actionError && <p className={styles.meta}><span className={styles.metaValue}>{actionError}</span></p>}
      <p className={styles.meta}>
        <span className={styles.metaValue}>{payload.reportedBy || t('onbekend')}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaValue}>{payload.date}</span>
        {payload.type === 'ehbo' && payload.uur && (
          <><span className={styles.metaSep}>·</span><span className={styles.metaValue}>{payload.uur}</span></>
        )}
      </p>
      {isResolved && payload.resolvedByName && (
        <p className={styles.meta}>
          <span className={styles.metaValue}>{t('opgelostDoor', { name: payload.resolvedByName })}</span>
        </p>
      )}

      {/* Body */}
      <div className={styles.body}>
          {payload.type === 'schade' && editing && draft && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('voertuig')}</p>
                <input className={styles.editInput} placeholder={t('type')} value={draft.typeVoertuig} onChange={(e) => setDraft({ ...draft, typeVoertuig: e.target.value })} />
                <input className={styles.editInput} placeholder={t('merkModel')} value={draft.merkModel} onChange={(e) => setDraft({ ...draft, merkModel: e.target.value })} />
                <input className={styles.editInput} placeholder={t('nummerplaat')} value={draft.nummerplaat} onChange={(e) => setDraft({ ...draft, nummerplaat: e.target.value })} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('eigenaar')}</p>
                <input className={styles.editInput} placeholder={t('naam')} value={draft.naamEigenaar} onChange={(e) => setDraft({ ...draft, naamEigenaar: e.target.value })} />
                <input className={styles.editInput} placeholder={t('telGsm')} value={draft.telGsm} onChange={(e) => setDraft({ ...draft, telGsm: e.target.value })} />
                <input className={styles.editInput} placeholder={t('email')} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('omschrijving')}</p>
                <textarea className={styles.editTextarea} value={draft.omschrijving} onChange={(e) => setDraft({ ...draft, omschrijving: e.target.value })} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('beoordeling')}</p>
                {([
                  ['onbetwist', t('onbetwist')],
                  ['installatiefout', t('installatiefout')],
                  ['klantVerantwoordelijk', t('klantVerantwoordelijk')],
                  ['verzekeringsdocumenten', t('verzekeringsdocumenten')],
                ] as const).map(([key, label]) => (
                  <label key={key} className={styles.editCheckboxRow}>
                    <input type="checkbox" checked={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {payload.type === 'schade' && !editing && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('voertuig')}</p>
                <Row label={t('type')}       value={payload.typeVoertuig} jaNee={jaNee} />
                <Row label={t('merkModel')}  value={payload.merkModel} jaNee={jaNee} />
                <Row label={t('nummerplaat')} value={payload.nummerplaat} jaNee={jaNee} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('eigenaar')}</p>
                <Row label={t('naam')}     value={payload.naamEigenaar} jaNee={jaNee} />
                <Row label={t('telGsm')}   value={payload.telGsm} jaNee={jaNee} />
                <Row label={t('email')}    value={payload.email} jaNee={jaNee} />
              </div>
              {payload.omschrijving && (
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>{t('omschrijving')}</p>
                  <p className={styles.textBlock}>{payload.omschrijving}</p>
                </div>
              )}
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('beoordeling')}</p>
                <BoolRow label={t('onbetwist')}              value={payload.onbetwist} jaNee={jaNee} />
                <BoolRow label={t('installatiefout')}         value={payload.installatiefout} jaNee={jaNee} />
                <BoolRow label={t('klantVerantwoordelijk')}  value={payload.klantVerantwoordelijk} jaNee={jaNee} />
                <BoolRow label={t('verzekeringsdocumenten')} value={payload.verzekeringsdocumenten} jaNee={jaNee} />
              </div>
            </>
          )}

          {payload.type === 'ehbo' && editing && ehboDraft && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('slachtoffer')}</p>
              <input className={styles.editInput} placeholder={t('naam')} value={ehboDraft.naamSlachtoffer} onChange={(e) => setEhboDraft({ ...ehboDraft, naamSlachtoffer: e.target.value })} />
              <input className={styles.editInput} placeholder={t('aard')} value={ehboDraft.verwonding} onChange={(e) => setEhboDraft({ ...ehboDraft, verwonding: e.target.value })} />
              <textarea className={styles.editTextarea} placeholder={t('beschrijving')} value={ehboDraft.beschrijving} onChange={(e) => setEhboDraft({ ...ehboDraft, beschrijving: e.target.value })} />
            </div>
          )}

          {payload.type === 'defect' && editing && defectDraft && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('defect')}</p>
              <select className={styles.editInput} value={defectDraft.ernst} onChange={(e) => setDefectDraft({ ...defectDraft, ernst: e.target.value })}>
                <option value="laag">{ernstLabels.laag}</option>
                <option value="medium">{ernstLabels.medium}</option>
                <option value="hoog">{ernstLabels.hoog}</option>
              </select>
              <textarea className={styles.editTextarea} value={defectDraft.omschrijving} onChange={(e) => setDefectDraft({ ...defectDraft, omschrijving: e.target.value })} />
            </div>
          )}

          {payload.type === 'ehbo' && !editing && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('slachtoffer')}</p>
                <Row label={t('naam')}              value={payload.naamSlachtoffer} jaNee={jaNee} />
                <Row label={t('afdelingLocatie')}   value={payload.afdelingLocatie} jaNee={jaNee} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('verwonding')}</p>
                <Row label={t('aard')}           value={payload.verwonding} jaNee={jaNee} />
                <Row label={t('ehboHandeling')} value={payload.ehboHandeling} jaNee={jaNee} />
                <Row label={t('ehboVerlener')}  value={payload.ehboVerlener} jaNee={jaNee} />
                <BoolRow label={t('dokterNodig')} value={payload.dokterNodig} jaNee={jaNee} />
              </div>
              {payload.beschrijving && (
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>{t('beschrijving')}</p>
                  <p className={styles.textBlock}>{payload.beschrijving}</p>
                </div>
              )}
            </>
          )}

          {payload.type === 'defect' && !editing && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>{t('defect')}</p>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{t('ernst')}</span>
                  <span className={[
                    styles.rowValue,
                    payload.ernst === 'hoog'   ? styles.ernstHoog   :
                    payload.ernst === 'medium' ? styles.ernstMedium :
                    styles.ernstLaag,
                  ].join(' ')}>
                    {ernstLabels[payload.ernst] ?? payload.ernst}
                  </span>
                </div>
              </div>
              {payload.omschrijving && (
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>{t('omschrijving')}</p>
                  <p className={styles.textBlock}>{payload.omschrijving}</p>
                </div>
              )}
            </>
          )}

        {photos.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('fotos')}</p>
            <div className={styles.photoGrid}>
              {photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={t('fotoAltText', { number: i + 1 })}
                  className={styles.photoThumb}
                  onClick={() => setLightboxSrc(src)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Historiek + reacties */}
        <ActivitySection refId={refId} refType={refType} siteId={siteId} />
      </div>

      {lightboxSrc && (
        <div className={styles.lightbox} onClick={() => setLightboxSrc(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxSrc} alt="" className={styles.lightboxImg} />
        </div>
      )}
    </BottomSheet>
  );
}
