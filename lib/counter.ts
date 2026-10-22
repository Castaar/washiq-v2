// Wash counter (tellerstand) resets. Internally every site keeps ONE continuous
// counter, so maintenance, brushes and wagen counts keep working across a reset.
// A reset is stored as { date, end_value }: the machine counter was set to 0 on
// that day after reaching end_value. An entry on/after that day holds the
// continuous value = machine reading + sum of end_values of resets up to its day.

export interface CounterReset {
  date: string; // YYYY-MM-DD (Brussels day the counter was set to 0)
  end_value: number; // machine counter value just before it was set to 0
}

// Amount to add to a machine reading taken on `day` to get the continuous value
export function counterOffset(resets: CounterReset[] | undefined | null, day: string): number {
  return (resets ?? []).filter((r) => r.date <= day).reduce((sum, r) => sum + (r.end_value || 0), 0);
}

export function toMachineReading(resets: CounterReset[] | undefined | null, day: string, continuous: number): number {
  return continuous - counterOffset(resets, day);
}

export function toContinuous(resets: CounterReset[] | undefined | null, day: string, machine: number): number {
  return machine + counterOffset(resets, day);
}

// Resets that happened after `fromDay` and on/before `toDay`
export function resetsBetween(resets: CounterReset[] | undefined | null, fromDay: string, toDay: string): CounterReset[] {
  return (resets ?? []).filter((r) => r.date > fromDay && r.date <= toDay).sort((a, b) => a.date.localeCompare(b.date));
}
