// Price configs are versioned per site (valid_from). A period is priced with the
// version that was valid on its date; dates before the first version use the first.
export function priceAt<T extends { valid_from?: Date | string | null }>(configs: T[], date: Date): T | null {
  if (configs.length === 0) return null;
  const sorted = [...configs].sort((a, b) => new Date(b.valid_from ?? 0).getTime() - new Date(a.valid_from ?? 0).getTime());
  return sorted.find((c) => new Date(c.valid_from ?? 0).getTime() <= date.getTime()) ?? sorted[sorted.length - 1];
}
