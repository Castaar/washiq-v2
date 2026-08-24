import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask, MaintenanceLog } from '@/lib/models';
import styles from './page.module.scss';

const TRIGGER_LABEL: Record<string, string> = {
  washes: 'wassen',
  months: 'maanden',
  fixed_date: 'vaste datum',
  fixed_months: 'vaste maanden',
};

function fmtDateTime(d: Date): string {
  return d.toLocaleString('nl-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Brussels',
  });
}

export default async function OnderhoudTaskHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const { taskId } = await params;
  const { site } = await searchParams;
  await dbConnect();

  const [task, logDocs] = await Promise.all([
    MaintenanceTask.findById(taskId).lean(),
    MaintenanceLog.find({ task_id: taskId })
      .sort({ done_at: -1 })
      .populate('done_by', 'name')
      .lean(),
  ]);

  const backHref = site ? `/onderhouden?site=${site}` : '/onderhouden';

  if (!task) {
    return (
      <div className={styles.root}>
        <NavBar centerTitle="Onderhoud" backHref={backHref} />
        <main className={styles.main}>
          <div className={styles.content}>
            <p className={styles.empty}>Onderhoudstaak niet gevonden.</p>
          </div>
        </main>
      </div>
    );
  }

  const triggerLabel = task.trigger_type === 'washes' && (task.trigger_value as number) > 0
    ? `Elke ${(task.trigger_value as number).toLocaleString('nl-BE')} wassen`
    : task.trigger_type === 'months' && (task.trigger_value as number) > 0
      ? `Elke ${task.trigger_value} maanden`
      : TRIGGER_LABEL[task.trigger_type as string] ?? '';

  const logs = logDocs.map((l) => ({
    id: (l._id as Types.ObjectId).toString(),
    doneAt: fmtDateTime(new Date(l.done_at as Date)),
    doneByName: (l.done_by as unknown as { name?: string } | null)?.name ?? 'Onbekend',
    notes: (l.notes as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <NavBar centerTitle="Historiek onderhoud" backHref={backHref} />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>{task.description as string}</h1>
            {triggerLabel && <p className={styles.subtitle}>{triggerLabel}</p>}
          </div>

          <div className={styles.list}>
            {logs.length === 0 ? (
              <p className={styles.empty}>Nog geen uitvoeringen geregistreerd voor deze taak.</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className={styles.logRow}>
                  <div className={styles.logMain}>
                    <span className={styles.logDate}>{l.doneAt}</span>
                    <span className={styles.logBy}>door {l.doneByName}</span>
                  </div>
                  {l.notes && <p className={styles.logNotes}>{l.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
