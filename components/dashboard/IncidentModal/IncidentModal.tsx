'use client';

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

function Row({ label, value }: { label: string; value: string | boolean | undefined }) {
  if (!value && value !== false) return null;
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>
        {typeof value === 'boolean' ? (value ? 'Ja' : 'Nee') : value}
      </span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={[styles.rowValue, value ? styles.yes : styles.no].join(' ')}>
        {value ? 'Ja' : 'Nee'}
      </span>
    </div>
  );
}

const ernstLabels: Record<string, string> = { laag: 'Laag', medium: 'Medium', hoog: 'Hoog' };
const typeLabels: Record<string, string>  = { schade: 'Schadegeval', ehbo: 'EHBO', defect: 'Defect / Panne' };

export function IncidentModal({ payload, refId, refType, siteId, onClose }: IncidentModalProps) {
  const typeLabel = typeLabels[payload.type] ?? payload.type;

  return (
    <BottomSheet open onClose={onClose} title={typeLabel}>
      <div className={styles.headerTop}>
        <span className={[styles.badge, styles[`badge-${payload.type}`]].join(' ')}>{typeLabel}</span>
      </div>
      <p className={styles.meta}>
        <span className={styles.metaValue}>{payload.reportedBy || 'Onbekend'}</span>
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
                <p className={styles.sectionTitle}>Voertuig</p>
                <Row label="Type"         value={payload.typeVoertuig} />
                <Row label="Merk / Model" value={payload.merkModel} />
                <Row label="Nummerplaat"  value={payload.nummerplaat} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Eigenaar</p>
                <Row label="Naam"      value={payload.naamEigenaar} />
                <Row label="Tel / GSM" value={payload.telGsm} />
                <Row label="E-mail"    value={payload.email} />
              </div>
              {payload.omschrijving && (
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Omschrijving</p>
                  <p className={styles.textBlock}>{payload.omschrijving}</p>
                </div>
              )}
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Beoordeling</p>
                <BoolRow label="Onbetwist"               value={payload.onbetwist} />
                <BoolRow label="Installatiefout"          value={payload.installatiefout} />
                <BoolRow label="Klant verantwoordelijk"  value={payload.klantVerantwoordelijk} />
                <BoolRow label="Verzekeringsdocumenten"  value={payload.verzekeringsdocumenten} />
              </div>
            </>
          )}

          {payload.type === 'ehbo' && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Slachtoffer</p>
                <Row label="Naam"               value={payload.naamSlachtoffer} />
                <Row label="Afdeling / Locatie" value={payload.afdelingLocatie} />
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Verwonding</p>
                <Row label="Aard"           value={payload.verwonding} />
                <Row label="EHBO-handeling" value={payload.ehboHandeling} />
                <Row label="EHBO-verlener"  value={payload.ehboVerlener} />
                <BoolRow label="Dokter nodig" value={payload.dokterNodig} />
              </div>
              {payload.beschrijving && (
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Beschrijving</p>
                  <p className={styles.textBlock}>{payload.beschrijving}</p>
                </div>
              )}
            </>
          )}

          {payload.type === 'defect' && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Defect</p>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Ernst</span>
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
                  <p className={styles.sectionTitle}>Omschrijving</p>
                  <p className={styles.textBlock}>{payload.omschrijving}</p>
                </div>
              )}
            </>
          )}

        {/* Historiek + reacties */}
        <ActivitySection refId={refId} refType={refType} siteId={siteId} />
      </div>
    </BottomSheet>
  );
}
