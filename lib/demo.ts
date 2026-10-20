// Demo sessions show real data, but personal details of third parties
// (damage reports: owner name, phone, e-mail, plate; EHBO: victim name) are masked.
export const DEMO_MASK = '•••• (demo)';

export function m(isDemo: boolean, value: string | undefined | null): string {
  if (!value) return '';
  return isDemo ? DEMO_MASK : value;
}
