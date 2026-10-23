'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './WashProgramManager.module.scss';

export interface WashProgramItem {
  id: string;
  siteId: string;
  name: string;
  tier: number;
  chemicals: string[];
}

export interface WashProgramSite {
  id: string;
  name: string;
}

export interface WashProgramStockItem {
  id: string;
  name: string;
  unit: string;
}

// ── Program row ───────────────────────────────────────────────
function ProgramRow({
  program,
  availableProducts,
  onDelete,
  onUpdate,
}: {
  program: WashProgramItem;
  availableProducts: WashProgramStockItem[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: Partial<WashProgramItem>) => void;
}) {
  const t = useTranslations('washPrograms');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(program.name);
  const [tier, setTier] = useState(program.tier);
  const [chemicals, setChemicals] = useState<string[]>(program.chemicals);
  const [saving, setSaving] = useState(false);

  function toggleChem(productName: string) {
    setChemicals((prev) =>
      prev.includes(productName) ? prev.filter((c) => c !== productName) : [...prev, productName],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tier, chemicals }),
      });
      onUpdate(program.id, { name, tier, chemicals });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('confirmVerwijderen', { name: program.name }))) return;
    await fetch(`/api/programs/${program.id}`, { method: 'DELETE' });
    onDelete(program.id);
  }

  return (
    <div className={styles.programCard}>
      <div className={styles.programHeader}>
        <div className={styles.programHeaderLeft}>
          <span className={styles.programTier}>{program.tier}</span>
          <span className={styles.programName}>{program.name}</span>
        </div>
        <div className={styles.rowActions}>
          <button type="button" className={styles.editBtn} onClick={() => setEditing((v) => !v)} aria-label={tCommon('bewerken')}>✏</button>
          <button type="button" className={styles.deleteBtn} onClick={handleDelete} aria-label={tCommon('verwijderen')}>✕</button>
        </div>
      </div>
      <div className={styles.chemPills}>
        {program.chemicals.length > 0
          ? program.chemicals.map((c) => (
              <span key={c} className={styles.chemPill}>{c}</span>
            ))
          : <span className={styles.noAccess}>{t('geenChemie')}</span>}
      </div>

      {editing && (
        <div className={styles.editPanel}>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>{t('naam')}</span>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>{t('tier')}</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              value={tier}
              onChange={(e) => setTier(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>{t('producten')}</span>
            {availableProducts.length === 0 ? (
              <span className={styles.noAccess}>{t('eerstProducten')}</span>
            ) : (
              <div className={styles.checkboxGroup}>
                {availableProducts.map((p) => (
                  <label key={p.id} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={chemicals.includes(p.name)}
                      onChange={() => toggleChem(p.name)}
                    />
                    {p.name} ({p.unit})
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>{tCommon('annuleren')}</button>
            <button type="button" className={styles.saveSmallBtn} onClick={handleSave} disabled={saving}>
              {saving ? `${tCommon('opslaan')}...` : tCommon('opslaan')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Site block (programs per site) ────────────────────────────
export function SiteProgramManager({
  site,
  allSites,
  programs,
  availableProducts,
  onDeleteProgram,
  onUpdateProgram,
  onAddProgram,
  showCopy = true,
}: {
  site: WashProgramSite;
  allSites: WashProgramSite[];
  programs: WashProgramItem[];
  availableProducts: WashProgramStockItem[];
  onDeleteProgram: (id: string) => void;
  onUpdateProgram: (id: string, updated: Partial<WashProgramItem>) => void;
  onAddProgram: (program: WashProgramItem) => void;
  showCopy?: boolean;
}) {
  const t = useTranslations('washPrograms');
  const tCommon = useTranslations('common');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addTier, setAddTier] = useState(programs.length + 1);
  const [addChemicals, setAddChemicals] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [showCopyForm, setShowCopyForm] = useState(false);
  const [copySiteId, setCopySiteId] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState('');

  const otherSites = allSites.filter((s) => s.id !== site.id);

  async function handleCopy(e: React.FormEvent) {
    e.preventDefault();
    if (!copySiteId) return;
    setCopying(true);
    setCopyResult('');
    try {
      const res = await fetch(`/api/sites/${copySiteId}/copy-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSiteId: site.id, copyPrograms: true, copyProducts: false, copyMaintenance: false }),
      });
      const data = (await res.json()) as { results?: { programs: number } };
      setCopyResult(t('gekopieerd', { count: String(data.results?.programs ?? 0) }));
    } finally {
      setCopying(false);
    }
  }

  function toggleAddChem(productName: string) {
    setAddChemicals((prev) =>
      prev.includes(productName) ? prev.filter((c) => c !== productName) : [...prev, productName],
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName) return;
    setAdding(true);
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id, name: addName, tier: addTier, chemicals: addChemicals }),
      });
      const data = (await res.json()) as { id?: string };
      if (res.ok && data.id) {
        onAddProgram({ id: data.id, siteId: site.id, name: addName, tier: addTier, chemicals: addChemicals });
        setAddName(''); setAddTier(programs.length + 2); setAddChemicals([]); setShowAdd(false);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.siteBlock}>
      <div className={styles.siteBlockHeader}>
        <span className={styles.siteBlockTitle}>{site.name}</span>
        {showCopy && otherSites.length > 0 && (
          <button type="button" className={styles.copySmallBtn} onClick={() => setShowCopyForm((v) => !v)}>
            {t('kopieerVan')}
          </button>
        )}
        <button type="button" className={styles.addSmallBtn} onClick={() => setShowAdd((v) => !v)}>
          {t('programmaToevoegen')}
        </button>
      </div>
      {showCopy && showCopyForm && (
        <form className={styles.copyForm} onSubmit={handleCopy} noValidate>
          <select
            className={styles.roleSelect}
            value={copySiteId}
            onChange={(e) => { setCopySiteId(e.target.value); setCopyResult(''); }}
          >
            <option value="">{t('kiesBronsite')}</option>
            {otherSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" className={styles.saveSmallBtn} disabled={copying || !copySiteId}>
            {copying ? tCommon('bezig') : t('kopieerProgrammas')}
          </button>
          {copyResult && <span className={styles.copyResult}>{copyResult}</span>}
        </form>
      )}

      {programs.length === 0 && !showAdd && (
        <p className={styles.noAccess}>{t('geenProgrammas')}</p>
      )}

      <div className={styles.programList}>
        {programs
          .slice()
          .sort((a, b) => a.tier - b.tier)
          .map((p) => (
            <ProgramRow
              key={p.id}
              program={p}
              availableProducts={availableProducts}
              onDelete={onDeleteProgram}
              onUpdate={onUpdateProgram}
            />
          ))}
      </div>

      {showAdd && (
        <form className={styles.addForm} onSubmit={handleAdd} noValidate>
          <div className={styles.addFormRow}>
            <div className={styles.addField}>
              <label className={styles.addLabel}>{t('naam')}</label>
              <input className={styles.input} value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={t('naamPlaceholder')} />
            </div>
            <div className={styles.addField} style={{ maxWidth: 100 }}>
              <label className={styles.addLabel}>{t('tier')}</label>
              <input className={styles.input} type="number" min={1} value={addTier} onChange={(e) => setAddTier(Number(e.target.value))} />
            </div>
          </div>
          <div className={styles.addFormRow}>
            <div className={styles.addFieldFull}>
              <label className={styles.addLabel}>{t('producten')}</label>
              {availableProducts.length === 0 ? (
                <span className={styles.noAccess}>{t('eerstProducten')}</span>
              ) : (
                <div className={styles.checkboxGroup}>
                  {availableProducts.map((p) => (
                    <label key={p.id} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={addChemicals.includes(p.name)}
                        onChange={() => toggleAddChem(p.name)}
                      />
                      {p.name} ({p.unit})
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.addFormFooter}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowAdd(false)}>{tCommon('annuleren')}</button>
            <button type="submit" className={styles.saveSmallBtn} disabled={adding}>{adding ? tCommon('bezig') : tCommon('opslaan')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
