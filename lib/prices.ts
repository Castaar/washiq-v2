// Price configs are versioned per site (valid_from). A period is priced with the
// version that was valid on its date; dates before the first version use the first.
export function priceAt<T extends { valid_from?: Date | string | null }>(configs: T[], date: Date): T | null {
  if (configs.length === 0) return null;
  const sorted = [...configs].sort((a, b) => new Date(b.valid_from ?? 0).getTime() - new Date(a.valid_from ?? 0).getTime());
  return sorted.find((c) => new Date(c.valid_from ?? 0).getTime() <= date.getTime()) ?? sorted[sorted.length - 1];
}

// Price per stock unit for a product. When a product is bought per kg but counted
// in liters, convert with its density: 1000 kg = X L  =>  1 L = 1000/X kg.
export function pricePerStockUnit(entry: { price_per_unit?: number; price_unit?: string; liters_per_1000kg?: number } | undefined | null): number {
  if (!entry) return 0;
  const price = entry.price_per_unit ?? 0;
  if (entry.price_unit === 'kg' && (entry.liters_per_1000kg ?? 0) > 0) {
    return price * (1000 / (entry.liters_per_1000kg as number));
  }
  return price;
}
