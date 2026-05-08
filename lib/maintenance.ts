type TaskLike = {
  trigger_type: string;
  trigger_value?: number | null;
  trigger_day?: number | null;
  trigger_month?: number | null;
  trigger_month_list?: number[] | null;
  last_done_at?: Date | string | null;
  is_overdue?: boolean | null;
  washes_at_last_done?: number | null;
};

export function computeIsOverdue(task: TaskLike, now: Date = new Date(), currentTellerstand?: number): boolean {
  switch (task.trigger_type) {
    case 'washes':
      if (currentTellerstand !== undefined) {
        const interval = task.trigger_value ?? 0;
        if (interval === 0) return false;
        return currentTellerstand >= (task.washes_at_last_done ?? 0) + interval;
      }
      return task.is_overdue ?? false;

    case 'fixed_date': {
      const triggerThisYear = new Date(
        now.getFullYear(),
        (task.trigger_month ?? 1) - 1,
        task.trigger_day ?? 1,
      );
      if (now < triggerThisYear) return false;
      if (!task.last_done_at) return true;
      return new Date(task.last_done_at) < triggerThisYear;
    }

    case 'fixed_months': {
      const currentMonth = now.getMonth() + 1;
      if (!(task.trigger_month_list ?? []).includes(currentMonth)) return false;
      if (!task.last_done_at) return true;
      const lastDone = new Date(task.last_done_at);
      return !(
        lastDone.getMonth() + 1 === currentMonth &&
        lastDone.getFullYear() === now.getFullYear()
      );
    }

    case 'months': {
      if (!task.last_done_at) return false;
      const lastDone = new Date(task.last_done_at);
      const monthsElapsed =
        (now.getFullYear() - lastDone.getFullYear()) * 12 +
        (now.getMonth() - lastDone.getMonth());
      return monthsElapsed >= (task.trigger_value ?? 0);
    }

    default:
      return false;
  }
}

// Returns true when a washes-type task is within the warning window (10% of interval, min 500)
export function computeIsApproaching(task: TaskLike, currentTellerstand: number): boolean {
  if (task.trigger_type !== 'washes') return false;
  const interval = task.trigger_value ?? 0;
  if (interval === 0) return false;
  const due = (task.washes_at_last_done ?? 0) + interval;
  if (currentTellerstand >= due) return false;
  const threshold = Math.max(500, Math.round(interval * 0.1));
  return currentTellerstand >= due - threshold;
}

// How many washes remain before a washes-type task is due (null if not a washes task)
export function washesRemaining(task: TaskLike, currentTellerstand: number): number | null {
  if (task.trigger_type !== 'washes') return null;
  const interval = task.trigger_value ?? 0;
  if (interval === 0) return null;
  return Math.max(0, (task.washes_at_last_done ?? 0) + interval - currentTellerstand);
}
