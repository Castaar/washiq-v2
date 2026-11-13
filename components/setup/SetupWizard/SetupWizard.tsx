'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import styles from './SetupWizard.module.scss';

interface SiteOption {
  id: string;
  name: string;
  setup_done: boolean;
}

interface Prices {
  water_per_liter: number;
  energy_per_kw: number;
  salt_per_kg: number;
  flock_per_kg: number;
  cloth_per_unit: number;
}

interface TaskDraft {
  description: string;
  trigger_type: 'washes' | 'weeks' | 'months' | 'fixed_date';
  trigger_value: number;
  trigger_day: number;
  trigger_month: number;
  last_done_at: string;
  washes_at_last_done: number;
}

interface Props {
  siteId: string;
  siteName: string;
  sites: SiteOption[];
  initialPrices: Prices;
  initialTasks: Omit<TaskDraft, 'trigger_day' | 'trigger_month'>[];
}

// Message keys (setup namespace) for the step labels, by step index.
const STEP_LABELS = ['stapWelkom', 'stapTellerstand', 'stapOnderhoud', 'stapPrijzen', 'stapKlaar'];
const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function emptyTask(): TaskDraft {
  return {
    description: '',
    trigger_type: 'washes',
    trigger_value: 0,
    trigger_day: 1,
    trigger_month: 1,
    last_done_at: '',
    washes_at_last_done: 0,
  };
}

export function SetupWizard({ siteId, siteName, sites, initialPrices, initialTasks }: Props) {
  const router = useRouter();
  const tr = useTranslations('setup');
  const tInst = useTranslations('instellingen');
  const tCommon = useTranslations('common');
  const tAccount = useTranslations('account');
  const locale = useLocale();
  const numLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const monthsShort = locale === 'fr'
    ? Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('fr-BE', { month: 'short' }))
    : MONTHS_NL;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [siteType, setSiteType] = useState<'wasstraat' | 'selfcarwash'>('wasstraat');

  const [tellerstand, setTellerstand] = useState(0);
  const [tellerstandDate, setTellerstandDate] = useState(new Date().toISOString().slice(0, 10));
  const [waterTellerstand, setWaterTellerstand] = useState(0);
  const [prices, setPrices] = useState<Prices>(initialPrices);
  const [priceRaw, setPriceRaw] = useState<Record<keyof Prices, string>>({
    water_per_liter: initialPrices.water_per_liter ? String(initialPrices.water_per_liter) : '',
    energy_per_kw: initialPrices.energy_per_kw ? String(initialPrices.energy_per_kw) : '',
    salt_per_kg: initialPrices.salt_per_kg ? String(initialPrices.salt_per_kg) : '',
    flock_per_kg: initialPrices.flock_per_kg ? String(initialPrices.flock_per_kg) : '',
    cloth_per_unit: initialPrices.cloth_per_unit ? String(initialPrices.cloth_per_unit) : '',
  });
  const [tasks, setTasks] = useState<TaskDraft[]>(
    initialTasks.length > 0
      ? initialTasks.map((t) => ({ ...t, trigger_type: t.trigger_type as TaskDraft['trigger_type'], trigger_day: 1, trigger_month: 1 }))
      : [emptyTask()],
  );
  const [newTask, setNewTask] = useState<TaskDraft>(emptyTask());
  const [addingTask, setAddingTask] = useState(false);
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

  function updatePrice(key: keyof Prices, raw: string) {
    setPriceRaw((r) => ({ ...r, [key]: raw }));
    const val = parseFloat(raw.replace(',', '.'));
    setPrices((p) => ({ ...p, [key]: isNaN(val) ? 0 : val }));
  }

  function addTask() {
    if (!newTask.description.trim()) return;
    setTasks((prev) => [...prev, { ...newTask }]);
    setNewTask(emptyTask());
    setAddingTask(false);
  }

  function removeTask(i: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          siteType,
          tellerstand,
          tellerstandDate,
          waterTellerstand,
          prices,
          maintenanceTasks: tasks.map((t) => ({
            description: t.description,
            trigger_type: t.trigger_type,
            trigger_value: t.trigger_value,
            trigger_day: t.trigger_day,
            trigger_month: t.trigger_month,
            last_done_at: t.last_done_at || undefined,
            washes_at_last_done: t.washes_at_last_done,
          })),
        }),
      });
      setStep(4);
    } finally {
      setSaving(false);
    }
  }

  // Selfcarwash sites skip the Tellerstand step (no wagen counting) — step
  // indices stay fixed (0=Welkom, 1=Tellerstand, 2=Onderhoud, 3=Prijzen,
  // 4=Klaar), only the visited order/labels change.
  const activeSteps = siteType === 'selfcarwash' ? [0, 2, 3, 4] : [0, 1, 2, 3, 4];
  const position = activeSteps.indexOf(step);
  const progressPct = Math.round((Math.max(position, 0) / (activeSteps.length - 1)) * 100);

  function handleClose() {
    const otherSite = sites.find((s) => s.id !== siteId && s.setup_done) ?? sites.find((s) => s.id !== siteId);
    if (otherSite) {
      document.cookie = `glosiv_active_site=${otherSite.id}; path=/; max-age=2592000; SameSite=Lax`;
      router.push(`/?site=${otherSite.id}`);
    } else {
      router.push('/');
    }
  }

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.siteName}>{siteName}</span>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label={tCommon('sluiten')}>✕</button>
        </div>
        <h1 className={styles.title}>{tr('titel')}</h1>
        <p className={styles.subtitle}>
          {step < 4
            ? tr('stapVan', {
                current: String(position + 1),
                total: String(activeSteps.length - 1),
                label: STEP_LABELS[activeSteps[position + 1]] ? tr(STEP_LABELS[activeSteps[position + 1]]) : '',
              })
            : tr('klaarUitroep')}
        </p>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Step 0: Welkom ─────────────────────────────────────── */}
      {step === 0 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            {tr.rich('welkomLead', { name: siteName, b: (chunks) => <strong>{chunks}</strong> })}
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>{tr('typeCarwash')}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="site_type"
                  value="wasstraat"
                  checked={siteType === 'wasstraat'}
                  onChange={() => setSiteType('wasstraat')}
                />
                {tr('typeWasstraat')}
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="site_type"
                  value="selfcarwash"
                  checked={siteType === 'selfcarwash'}
                  onChange={() => setSiteType('selfcarwash')}
                />
                {tr('typeSelfcarwash')}
              </label>
            </div>
          </div>

          {siteType === 'selfcarwash' ? (
            <ul className={styles.checkList}>
              <li>{tr('selfVoorraad')}</li>
              <li>{tr('selfOnderhoud')}</li>
              <li>{tr('selfLogboek')}</li>
              <li>{tr('kostprijzenInstellen')}</li>
            </ul>
          ) : (
            <ul className={styles.checkList}>
              <li>{tr('wasTellerstand')}</li>
              <li>{tr('wasOnderhoud')}</li>
              <li>{tr('kostprijzenInstellen')}</li>
            </ul>
          )}
          {sites.filter((s) => !s.setup_done && s.id !== siteId).length > 0 && (
            <p className={styles.hint}>
              {tr('andereSites', { sites: sites.filter((s) => !s.setup_done && s.id !== siteId).map((s) => s.name).join(', ') })}
            </p>
          )}
          <button className={styles.btnPrimary} onClick={() => setStep(siteType === 'selfcarwash' ? 2 : 1)}>
            {tr('startConfiguratie')}
          </button>
        </div>
      )}

      {/* ── Step 1: Tellerstand ────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            {tr('tellerstandLead')}
          </p>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="tellerstand">
              {tr('huidigAantal')}
            </label>
            <input
              id="tellerstand"
              type="number"
              min={0}
              className={styles.input}
              value={tellerstand || ''}
              placeholder={tInst('bijv', { value: '125400' })}
              onChange={(e) => setTellerstand(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="tellerstandDate">
              {tr('datumTellerstand')}
            </label>
            <input
              id="tellerstandDate"
              type="date"
              className={styles.input}
              value={tellerstandDate}
              onChange={(e) => setTellerstandDate(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="waterTellerstand">
              {tr('waterTellerstand')}
            </label>
            <input
              id="waterTellerstand"
              type="number"
              min={0}
              className={styles.input}
              value={waterTellerstand || ''}
              placeholder={tInst('bijv', { value: '4500' })}
              onChange={(e) => setWaterTellerstand(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className={styles.navRow}>
            <button className={styles.btnSecondary} onClick={() => setStep(0)}>← {tCommon('terug')}</button>
            <button className={styles.btnPrimary} onClick={() => setStep(2)}>{tr('volgende')}</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Onderhoudstaken ────────────────────────────── */}
      {step === 2 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            {tr.rich('onderhoudLead', { b: (chunks) => <strong>{chunks}</strong> })}
          </p>

          {/* Existing tasks */}
          {tasks.length > 0 && (
            <div className={styles.taskList}>
              {tasks.map((t, i) => (
                <div key={i} className={styles.taskRow}>
                  <div className={styles.taskRowInner}>
                    <div className={styles.taskInfo}>
                      <span className={styles.taskDesc}>{t.description}</span>
                      <span className={styles.taskTrigger}>
                        {t.trigger_type === 'washes'
                          ? tInst('elkeWasbeurten', { count: t.trigger_value.toLocaleString(numLocale) })
                          : t.trigger_type === 'fixed_date'
                          ? tr('jaarlijksOp', { day: String(t.trigger_day), month: monthsShort[(t.trigger_month ?? 1) - 1] })
                          : tr('elkeMaandEn', { count: String(t.trigger_value) })}
                        {t.last_done_at && ` — ${tr('laatsteKeer', { date: t.last_done_at })}`}
                        {t.trigger_type === 'washes' && t.washes_at_last_done > 0 && ` (${tr('wasAfk', { count: t.washes_at_last_done.toLocaleString(numLocale) })})`}
                      </span>
                    </div>
                    <div className={styles.taskRowActions}>
                      <button
                        type="button"
                        className={styles.editTaskBtn}
                        onClick={() => setEditingTaskIdx(editingTaskIdx === i ? null : i)}
                        title={tr('laatsteUitvoeringInvullen')}
                      >
                        ✏
                      </button>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => removeTask(i)}
                        title={tCommon('verwijderen')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {editingTaskIdx === i && (
                    <div className={styles.taskEditPanel}>
                      <div className={styles.fieldRow}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>{tInst('datumLaatsteUitvoering')}</label>
                          <input
                            type="date"
                            className={styles.input}
                            value={t.last_done_at}
                            onChange={(e) => setTasks((prev) => prev.map((task, idx) => idx === i ? { ...task, last_done_at: e.target.value } : task))}
                          />
                        </div>
                        {t.trigger_type === 'washes' && (
                          <div className={styles.fieldGroup}>
                            <label className={styles.label}>{tInst('tellerstandLaatsteKeer')}</label>
                            <input
                              type="number"
                              min={0}
                              className={styles.input}
                              placeholder={tInst('bijv', { value: '120000' })}
                              value={t.washes_at_last_done || ''}
                              onChange={(e) => setTasks((prev) => prev.map((task, idx) => idx === i ? { ...task, washes_at_last_done: parseInt(e.target.value) || 0 } : task))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add task form */}
          {addingTask ? (
            <div className={styles.addTaskForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>{tInst('omschrijving')}</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={tInst('omschrijvingPlaceholder')}
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>{tInst('typeTrigger')}</label>
                <div className={styles.radioGroup}>
                  {([['washes', tInst('triggerWasbeurten')], ['weeks', tInst('triggerWeken')], ['months', tInst('triggerMaanden')], ['fixed_date', tInst('triggerVasteDatum')]] as [TaskDraft['trigger_type'], string][])
                    .filter(([val]) => siteType !== 'selfcarwash' || val !== 'washes')
                    .map(([val, lbl]) => (
                    <label key={val} className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="trigger_type"
                        value={val}
                        checked={newTask.trigger_type === val}
                        onChange={() => setNewTask((t) => ({ ...t, trigger_type: val }))}
                      />
                      {lbl}
                    </label>
                  ))}
                </div>
              </div>

              {newTask.trigger_type === 'washes' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('intervalWasbeurten')}</label>
                    <input
                      type="number"
                      min={1}
                      className={styles.input}
                      placeholder={tInst('bijv', { value: '5000' })}
                      value={newTask.trigger_value || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('tellerstandLaatsteKeer')}</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.input}
                      placeholder={tInst('bijv', { value: '120000' })}
                      value={newTask.washes_at_last_done || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, washes_at_last_done: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('datumLaatsteKeer')}</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newTask.last_done_at}
                      onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {(newTask.trigger_type === 'months' || newTask.trigger_type === 'weeks') && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{newTask.trigger_type === 'weeks' ? tInst('intervalWeken') : tInst('intervalMaanden')}</label>
                    <input
                      type="number"
                      min={1}
                      className={styles.input}
                      placeholder={tInst('bijv', { value: '3' })}
                      value={newTask.trigger_value || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('datumLaatsteUitvoering')}</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newTask.last_done_at}
                      onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {newTask.trigger_type === 'fixed_date' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('dag')}</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className={styles.input}
                      value={newTask.trigger_day || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_day: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tAccount('maand')}</label>
                    <select
                      className={styles.input}
                      value={newTask.trigger_month}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_month: parseInt(e.target.value) }))}
                    >
                      {monthsShort.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>{tInst('datumLaatsteUitvoering')}</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newTask.last_done_at}
                      onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className={styles.addTaskActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => { setAddingTask(false); setNewTask(emptyTask()); }}>{tCommon('annuleren')}</button>
                <button type="button" className={styles.btnPrimary} onClick={addTask} disabled={!newTask.description.trim()}>{tInst('taakToevoegen')}</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => {
                if (siteType === 'selfcarwash') setNewTask((t) => ({ ...t, trigger_type: 'months' }));
                setAddingTask(true);
              }}
            >
              {tInst('onderhoudstaakToevoegen')}
            </button>
          )}

          <div className={styles.navRow}>
            <button className={styles.btnSecondary} onClick={() => setStep(siteType === 'selfcarwash' ? 0 : 1)}>← {tCommon('terug')}</button>
            <button className={styles.btnPrimary} onClick={() => setStep(3)}>{tr('volgende')}</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Prijzen ────────────────────────────────────── */}
      {step === 3 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            {tr('prijzenLead')}
          </p>
          <div className={styles.priceGrid}>
            {([
              ['water_per_liter', tr('prijsWater'), tr('eenheidLiter')],
              ['energy_per_kw', tr('prijsEnergie'), '€ / kWh'],
              ['salt_per_kg', tr('prijsZout'), '€ / kg'],
              ['flock_per_kg', tr('prijsFlock'), '€ / kg'],
              ['cloth_per_unit', tr('prijsRuitendoekjes'), tr('eenheidStuk')],
            ] as [keyof Prices, string, string][]).map(([key, label, unit]) => (
              <div key={key} className={styles.priceField}>
                <label className={styles.label}>{label}</label>
                <div className={styles.inputUnit}>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    className={styles.input}
                    value={priceRaw[key]}
                    placeholder="0.000"
                    onChange={(e) => updatePrice(key, e.target.value)}
                  />
                  <span className={styles.unit}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.navRow}>
            <button className={styles.btnSecondary} onClick={() => setStep(2)}>← {tCommon('terug')}</button>
            <button className={styles.btnPrimary} onClick={handleFinish} disabled={saving}>
              {saving ? tr('bezigOpslaan') : tr('opslaanAfronden')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Klaar ─────────────────────────────────────── */}
      {step === 4 && (
        <div className={styles.body}>
          <div className={styles.doneIcon} aria-hidden="true">✓</div>
          <p className={styles.lead}>
            {tr.rich('klaarLead', { name: siteName, b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <ul className={styles.checkList}>
            {siteType === 'wasstraat' && (
              <>
                <li>{tr('tellerstandOpgeslagen', { count: tellerstand.toLocaleString(numLocale) })}</li>
                <li>{tr('waterOpgeslagen', { count: waterTellerstand.toLocaleString(numLocale) })}</li>
              </>
            )}
            <li>{tr('takenGeconfigureerd', { count: tasks.length })}</li>
            <li>{tr('kostprijzenIngesteld')}</li>
          </ul>
          <button
            className={styles.btnPrimary}
            onClick={() => router.push(`/?site=${siteId}`)}
          >
            {tr('naarDashboard')}
          </button>
        </div>
      )}
    </div>
  );
}
