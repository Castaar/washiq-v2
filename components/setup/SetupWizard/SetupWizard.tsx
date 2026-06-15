'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  trigger_type: 'washes' | 'months' | 'fixed_date';
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

const STEPS = ['Welkom', 'Tellerstand', 'Onderhoud', 'Prijzen', 'Klaar'];
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
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [tellerstand, setTellerstand] = useState(0);
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
          tellerstand,
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

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.siteName}>{siteName}</span>
        <h1 className={styles.title}>Eerste configuratie</h1>
        <p className={styles.subtitle}>
          {step < STEPS.length - 1
            ? `Stap ${step + 1} van ${STEPS.length - 1} — ${STEPS[step + 1] ?? ''}`
            : 'Klaar!'}
        </p>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Step 0: Welkom ─────────────────────────────────────── */}
      {step === 0 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            Welkom bij WashIQ. Deze wizard helpt je de site <strong>{siteName}</strong> in enkele
            minuten klaar te zetten. Je kan dit altijd later aanpassen via de instellingen.
          </p>
          <ul className={styles.checkList}>
            <li>Huidige tellerstand ingeven</li>
            <li>Onderhoudstaken configureren (op wassen of op datum)</li>
            <li>Kostprijzen per eenheid instellen</li>
          </ul>
          {sites.filter((s) => !s.setup_done && s.id !== siteId).length > 0 && (
            <p className={styles.hint}>
              Andere sites zonder configuratie: {sites.filter((s) => !s.setup_done && s.id !== siteId).map((s) => s.name).join(', ')}.
            </p>
          )}
          <button className={styles.btnPrimary} onClick={() => setStep(1)}>
            Start configuratie →
          </button>
        </div>
      )}

      {/* ── Step 1: Tellerstand ────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            Voer de huidige stand in van de hoofdteller van de wasstraat. Dit is het totale aantal
            wassen dat de machine heeft uitgevoerd.
          </p>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="tellerstand">
              Huidig aantal wassen (tellerstand)
            </label>
            <input
              id="tellerstand"
              type="number"
              min={0}
              className={styles.input}
              value={tellerstand || ''}
              placeholder="bijv. 125400"
              onChange={(e) => setTellerstand(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className={styles.navRow}>
            <button className={styles.btnSecondary} onClick={() => setStep(0)}>← Terug</button>
            <button className={styles.btnPrimary} onClick={() => setStep(2)}>Volgende →</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Onderhoudstaken ────────────────────────────── */}
      {step === 2 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            Voeg de terugkerende onderhoudstaken toe voor deze site. Kies of een taak getriggerd
            wordt op een <strong>aantal wassen</strong> of na een <strong>bepaald aantal maanden</strong>.
          </p>

          {/* Existing tasks */}
          {tasks.length > 0 && (
            <div className={styles.taskList}>
              {tasks.map((t, i) => (
                <div key={i} className={styles.taskRow}>
                  <div className={styles.taskInfo}>
                    <span className={styles.taskDesc}>{t.description}</span>
                    <span className={styles.taskTrigger}>
                      {t.trigger_type === 'washes'
                        ? `Elke ${t.trigger_value.toLocaleString('nl-BE')} wassen`
                        : t.trigger_type === 'fixed_date'
                        ? `Jaarlijks op ${t.trigger_day} ${MONTHS_NL[(t.trigger_month ?? 1) - 1]}`
                        : `Elke ${t.trigger_value} maand(en)`}
                      {t.last_done_at && ` — laatste keer: ${t.last_done_at}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeTask(i)}
                    title="Verwijderen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add task form */}
          {addingTask ? (
            <div className={styles.addTaskForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Omschrijving</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="bijv. Borstels nakijken"
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Type trigger</label>
                <div className={styles.radioGroup}>
                  {([['washes', 'Op aantal wassen'], ['months', 'Op aantal maanden'], ['fixed_date', 'Vaste datum per jaar']] as [TaskDraft['trigger_type'], string][]).map(([val, lbl]) => (
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
                    <label className={styles.label}>Interval (wassen)</label>
                    <input
                      type="number"
                      min={1}
                      className={styles.input}
                      placeholder="bijv. 5000"
                      value={newTask.trigger_value || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Tellerstand laatste keer</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.input}
                      placeholder="bijv. 120000"
                      value={newTask.washes_at_last_done || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, washes_at_last_done: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              )}

              {newTask.trigger_type === 'months' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Interval (maanden)</label>
                    <input
                      type="number"
                      min={1}
                      className={styles.input}
                      placeholder="bijv. 3"
                      value={newTask.trigger_value || ''}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Datum laatste uitvoering</label>
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
                    <label className={styles.label}>Dag</label>
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
                    <label className={styles.label}>Maand</label>
                    <select
                      className={styles.input}
                      value={newTask.trigger_month}
                      onChange={(e) => setNewTask((t) => ({ ...t, trigger_month: parseInt(e.target.value) }))}
                    >
                      {MONTHS_NL.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Datum laatste uitvoering</label>
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
                <button type="button" className={styles.btnSecondary} onClick={() => { setAddingTask(false); setNewTask(emptyTask()); }}>Annuleren</button>
                <button type="button" className={styles.btnPrimary} onClick={addTask} disabled={!newTask.description.trim()}>Taak toevoegen</button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.btnOutline} onClick={() => setAddingTask(true)}>
              + Onderhoudstaak toevoegen
            </button>
          )}

          <div className={styles.navRow}>
            <button className={styles.btnSecondary} onClick={() => setStep(1)}>← Terug</button>
            <button className={styles.btnPrimary} onClick={() => setStep(3)}>Volgende →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Prijzen ────────────────────────────────────── */}
      {step === 3 && (
        <div className={styles.body}>
          <p className={styles.lead}>
            Stel de kostprijs per eenheid in. Deze worden gebruikt om de kostprijs per wasbeurt te
            berekenen. Je kunt ze later altijd aanpassen via de instellingen.
          </p>
          <div className={styles.priceGrid}>
            {([
              ['water_per_liter', 'Water', '€ / liter'],
              ['energy_per_kw', 'Energie', '€ / kWh'],
              ['salt_per_kg', 'Zout', '€ / kg'],
              ['flock_per_kg', 'Flockmiddel', '€ / kg'],
              ['cloth_per_unit', 'Ruitendoekjes', '€ / stuk'],
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
            <button className={styles.btnSecondary} onClick={() => setStep(2)}>← Terug</button>
            <button className={styles.btnPrimary} onClick={handleFinish} disabled={saving}>
              {saving ? 'Bezig met opslaan...' : 'Opslaan & afronden →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Klaar ─────────────────────────────────────── */}
      {step === 4 && (
        <div className={styles.body}>
          <div className={styles.doneIcon} aria-hidden="true">✓</div>
          <p className={styles.lead}>
            <strong>{siteName}</strong> is klaar voor gebruik. Je kan nu beginnen met het registreren
            van verbruik, onderhoud en incidenten.
          </p>
          <ul className={styles.checkList}>
            <li>Tellerstand opgeslagen: {tellerstand.toLocaleString('nl-BE')} wassen</li>
            <li>{tasks.length} onderhoudstaak{tasks.length !== 1 ? 'en' : ''} geconfigureerd</li>
            <li>Kostprijzen ingesteld</li>
          </ul>
          <button
            className={styles.btnPrimary}
            onClick={() => router.push(`/?site=${siteId}`)}
          >
            Naar het dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
