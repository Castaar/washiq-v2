'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge/Badge';
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
  siteId = '',
}: {
  tasks: OnderhoudTask[];
  siteId?: string;
}) {
  const [tasks, setTasks] = useState(initial);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

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

  return (
    <div className={styles.wrap}>
      {overdue.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Verlopen</h2>
          {overdue.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              note={noteDrafts[t.id] ?? ''}
              onNoteChange={(v) => setNoteDrafts((prev) => ({ ...prev, [t.id]: v }))}
              confirming={confirmId === t.id}
              onConfirmToggle={(v) => setConfirmId(v ? t.id : null)}
              onComplete={() => handleComplete(t)}
              completing={completing === t.id}
              siteId={siteId}
            />
          ))}
        </div>
      )}

      {approaching.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Binnenkort</h2>
          {approaching.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              note={noteDrafts[t.id] ?? ''}
              onNoteChange={(v) => setNoteDrafts((prev) => ({ ...prev, [t.id]: v }))}
              confirming={confirmId === t.id}
              onConfirmToggle={(v) => setConfirmId(v ? t.id : null)}
              onComplete={() => handleComplete(t)}
              completing={completing === t.id}
              siteId={siteId}
            />
          ))}
        </div>
      )}

      {ok.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>In orde</h2>
          {ok.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              note={noteDrafts[t.id] ?? ''}
              onNoteChange={(v) => setNoteDrafts((prev) => ({ ...prev, [t.id]: v }))}
              confirming={confirmId === t.id}
              onConfirmToggle={(v) => setConfirmId(v ? t.id : null)}
              onComplete={() => handleComplete(t)}
              completing={completing === t.id}
              siteId={siteId}
            />
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <p className={styles.empty}>Geen onderhoudstaken gevonden. Voeg taken toe in instellingen.</p>
      )}
    </div>
  );
}

function TaskCard({
  task,
  note,
  onNoteChange,
  confirming,
  onConfirmToggle,
  onComplete,
  completing,
  siteId,
}: {
  task: OnderhoudTask;
  note: string;
  onNoteChange: (value: string) => void;
  confirming: boolean;
  onConfirmToggle: (value: boolean) => void;
  onComplete: () => void;
  completing: boolean;
  siteId: string;
}) {
  return (
    <div className={[styles.taskCard, task.isOverdue ? styles.overdue : task.isApproaching ? styles.approaching : styles.ok].join(' ')}>
      <div className={styles.taskBody}>
        <div className={styles.taskTitleRow}>
          <p className={styles.taskTitle}>{task.description}</p>
          {task.isOverdue ? (
            <Badge variant="red" size="sm">Te laat</Badge>
          ) : task.isApproaching ? (
            <Badge variant="amber" size="sm">Bijna</Badge>
          ) : (
            <Badge variant="teal" size="sm">Op schema</Badge>
          )}
        </div>
        <Link href={`/onderhouden/${task.id}?site=${siteId}`} className={styles.historyLink}>
          Historiek bekijken →
        </Link>
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
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
      {confirming ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>Bevestigen?</span>
          <button type="button" className={styles.confirmYes} onClick={onComplete} disabled={completing}>
            {completing ? '...' : 'Ja'}
          </button>
          <button type="button" className={styles.confirmNo} onClick={() => onConfirmToggle(false)}>Nee</button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.completeBtn}
          onClick={() => onConfirmToggle(true)}
          disabled={completing}
        >
          Uitgevoerd
        </button>
      )}
    </div>
  );
}
