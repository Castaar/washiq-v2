'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

export function OnderhoudPanel({
  tasks: initial,
  siteId = '',
}: {
  tasks: OnderhoudTask[];
  siteId?: string;
}) {
  const t = useTranslations('onderhoud');
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
          <h2 className={styles.sectionTitle}>{t('verlopen')}</h2>
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
          <h2 className={styles.sectionTitle}>{t('binnenkort')}</h2>
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
          <h2 className={styles.sectionTitle}>{t('inOrde')}</h2>
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
        <p className={styles.empty}>{t('geenTaken')}</p>
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
  const t = useTranslations('onderhoud');
  const tAlerts = useTranslations('alerts');
  const TRIGGER_LABEL: Record<string, string> = {
    washes: t('wassingen'),
    months: t('maanden'),
    fixed_date: t('vasteDatum'),
    fixed_months: t('vasteMaanden'),
  };
  return (
    <div className={[styles.taskCard, task.isOverdue ? styles.overdue : task.isApproaching ? styles.approaching : styles.ok].join(' ')}>
      <div className={styles.taskBody}>
        <div className={styles.taskTitleRow}>
          <p className={styles.taskTitle}>{task.description}</p>
          {task.isOverdue ? (
            <Badge variant="red" size="sm">{t('teLaat')}</Badge>
          ) : task.isApproaching ? (
            <Badge variant="amber" size="sm">{t('bijna')}</Badge>
          ) : (
            <Badge variant="teal" size="sm">{t('opSchema')}</Badge>
          )}
        </div>
        <Link href={`/onderhouden/${task.id}?site=${siteId}`} className={styles.historyLink}>
          {t('historiekBekijken')}
        </Link>
        <div className={styles.taskMeta}>
          {task.triggerType === 'washes' && task.triggerValue > 0 && (
            <span>{t('elke', { count: task.triggerValue.toLocaleString('nl-BE'), unit: TRIGGER_LABEL[task.triggerType] })}</span>
          )}
          {task.triggerType === 'months' && task.triggerValue > 0 && (
            <span>{t('elke', { count: task.triggerValue, unit: TRIGGER_LABEL[task.triggerType] })}</span>
          )}
          {task.lastDoneAt && <span>{t('laatsteKeer', { date: task.lastDoneAt })}</span>}
          {task.washesRemaining != null && task.washesRemaining > 0 && (
            <span className={styles.remaining}>{t('nogTeGaan', { count: task.washesRemaining.toLocaleString('nl-BE'), unit: t('wassingen') })}</span>
          )}
          {task.isOverdue && task.washesRemaining != null && task.washesRemaining <= 0 && (
            <span className={styles.overdueLabel}>{t('verlopen')}</span>
          )}
        </div>
        <input
          className={styles.noteInput}
          type="text"
          placeholder={t('opmerkingOptioneel')}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
      {confirming ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>{t('bevestigen')}</span>
          <button type="button" className={styles.confirmYes} onClick={onComplete} disabled={completing}>
            {completing ? '...' : tAlerts('ja')}
          </button>
          <button type="button" className={styles.confirmNo} onClick={() => onConfirmToggle(false)}>{tAlerts('nee')}</button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.completeBtn}
          onClick={() => onConfirmToggle(true)}
          disabled={completing}
        >
          {t('uitgevoerd')}
        </button>
      )}
    </div>
  );
}
