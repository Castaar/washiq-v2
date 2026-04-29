type TaskLike = {
  trigger_type: string;
  trigger_value?: number | null;
  trigger_day?: number | null;
  trigger_month?: number | null;
  trigger_month_list?: number[] | null;
  last_done_at?: Date | string | null;
  is_overdue?: boolean | null;
};

export function computeIsOverdue(task: TaskLike, now: Date = new Date()): boolean {
  switch (task.trigger_type) {
    case 'washes':
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
