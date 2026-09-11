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

  // EHBO has no resolved-state — only schade/defect can be marked resolved.
  const canResolve = payload.type === 'schade' || payload.type === 'defect';
  const [isResolved, setIsResolved] = useState(canResolve ? Boolean(payload.isResolved) : false);
  const [resolving, setResolving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const photos = payload.photos ?? [];

  async function handleToggleResolve() {
    if (!canResolve) return;
    setResolving(true);
    try {
      const endpoint = payload.type === 'defect'
        ? `/api/incidents/defect/${refId}`
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
      </div>
      <p className={styles.meta}>
        <span className={styles.metaValue}>{payload.reportedBy || t('onbekend')}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaValue}>{payload.date}</span>
        {payload.type === 'ehbo' && payload.uur && (
          <><span className={styles.metaSep}>·</span><span className={styles.metaValue}>{payload.uur}</span></>
        )}
      </p>

      {/* Body */}
      <div className={styles.body}>
          {payload.type === 'schade' && (
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

          {payload.type === 'ehbo' && (
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

          {payload.type === 'defect' && (
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
