'use client';

import { useState } from 'react';
import styles from './OnderhoudPanel.module.scss';

export interface OnderhoudTask {
  id: string;
  description: string;
  triggerType: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
  triggerValue: number;
  lastDoneAt?: string;
  washesAtLastDone?: number;
  isOverdue: boolean;
  isApproaching: boolean;
  washesRemaining?: number | null;
}

const TRIGGER_LABEL: Record<string, string> = {
  washes: 'wassen',
  months: 'maanden',
  fixed_date: 'vaste datum',
  fixed_months: 'vaste maanden',
};

export function OnderhoudPanel({
  tasks: initial,
  siteId,
  currentTellerstand,
}: {
  tasks: OnderhoudTask[];
  siteId: string;
  currentTellerstand: number;
}) {
  const [tasks, setTasks] = useState(initial);
  const [tellerstand, setTellerstand] = useState(currentTellerstand);
  const [tellerDraft, setTellerDraft] = useState('');
  const [tellerSaving, setTellerSaving] = useState(false);
  const [tellerSaved, setTellerSaved] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleUpdateTellerstand() {
    const val = parseInt(tellerDraft, 10);
    if (isNaN(val) || val < 0) return;
    setTellerSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_car_count: val }),
      });
      if (res.ok) {
        setTellerstand(val);
        setTellerDraft('');
        setTellerSaved(true);
        setTimeout(() => setTellerSaved(false), 2000);
      }
    } finally {
      setTellerSaving(false);
    }
  }

  async function handleComplete(task: OnderhoudTask) {
    setCompleting(task.id);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/maintenance/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteDrafts[task.id]?.trim() ?? '' }),
      });
      if (res.ok) {
        const now = new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        setTasks((prev) => prev.map((t) => t.id === task.id
          ? { ...t, isOverdue: false, isApproaching: false, lastDoneAt: now }
          : t,
        ));
        setNoteDrafts((prev) => { const n = { ...prev }; delete n[task.id]; return n; });
      }
    } finally {
      setCompleting(null);
    }
  }

  const overdue = tasks.filter((t) => t.isOverdue);
  const approaching = tasks.filter((t) => !t.isOverdue && t.isApproaching);
  const ok = tasks.filter((t) => !t.isOverdue && !t.isApproaching);

  function TaskCard({ task }: { task: OnderhoudTask }) {
    return (
      <div className={[styles.taskCard, task.isOverdue ? styles.overdue : task.isApproaching ? styles.approaching : styles.ok].join(' ')}>
        <div className={styles.taskBody}>
          <p className={styles.taskTitle}>{task.description}</p>
          <div className={styles.taskMeta}>
            {task.triggerType === 'washes' && task.triggerValue > 0 && (
              <span>Elke {task.triggerValue.toLocaleString('nl-BE')} {TRIGGER_LABEL[task.triggerType]}</span>
            )}
            {task.triggerType === 'months' && task.triggerValue > 0 && (
              <span>Elke {task.triggerValue} {TRIGGER_LABEL[task.triggerType]}</span>
            )}
            {task.lastDoneAt && <span>Laatste keer: {task.lastDoneAt}</span>}
            {task.washesRemaining != null && task.washesRemaining > 0 && (
              <span className={styles.remaining}>Nog {task.washesRemaining.toLocaleString('nl-BE')} wassen</span>
            )}
            {task.isOverdue && task.washesRemaining != null && task.washesRemaining <= 0 && (
              <span className={styles.overdueLabel}>Verlopen</span>
            )}
          </div>
          <input
            className={styles.noteInput}
            type="text"
            placeholder="Opmerking (optioneel)"
            value={noteDrafts[task.id] ?? ''}
            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
          />
        </div>
        {confirmId === task.id ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>Bevestigen?</span>
            <button type="button" className={styles.confirmYes} onClick={() => handleComplete(task)} disabled={completing === task.id}>
              {completing === task.id ? '...' : 'Ja'}
            </button>
            <button type="button" className={styles.confirmNo} onClick={() => setConfirmId(null)}>Nee</button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.completeBtn}
            onClick={() => setConfirmId(task.id)}
            disabled={completing === task.id}
          >
            Uitgevoerd
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Tellerstand */}
      <div className={styles.tellerCard}>
        <div className={styles.tellerInfo}>
          <span className={styles.tellerLabel}>Huidige tellerstand</span>
          <span className={styles.tellerValue}>{tellerstand.toLocaleString('nl-BE')} wassen</span>
        </div>
        <div className={styles.tellerInput}>
          <input
            className={styles.tellerField}
            type="number"
            min="0"
            placeholder="Nieuwe stand..."
            value={tellerDraft}
            onChange={(e) => setTellerDraft(e.target.value)}
          />
          <button
            type="button"
            className={styles.tellerBtn}
            onClick={handleUpdateTellerstand}
            disabled={tellerSaving || !tellerDraft}
          >
            {tellerSaved ? '✓' : tellerSaving ? '...' : 'Bijwerken'}
          </button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Verlopen</h2>
          {overdue.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {approaching.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Binnenkort</h2>
          {approaching.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {ok.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>In orde</h2>
          {ok.map((t) => <TaskCard key={t.id} task={t} />)}
        </div>
      )}

      {tasks.length === 0 && (
        <p className={styles.empty}>Geen onderhoudstaken gevonden. Voeg taken toe in instellingen.</p>
      )}
    </div>
  );
}
