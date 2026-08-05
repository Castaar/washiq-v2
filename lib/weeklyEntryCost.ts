interface CostInputs {
  water_liters?: number;
  energy_kw?: number;
  salt_kg?: number;
  flock_kg?: number;
  cloth_units?: number;
  chemical_usages?: { name: string; amount: number }[];
}

interface PriceConfigLike {
  water_per_liter?: number;
  energy_per_kw?: number;
  salt_per_kg?: number;
  flock_per_kg?: number;
  cloth_per_unit?: number;
  chemicals?: { name: string; price_per_unit: number }[];
}

export function computeTotalCost(body: CostInputs, priceConfig: PriceConfigLike | null): number {
  if (!priceConfig) return 0;

  let total_cost = 0;
  total_cost += (body.water_liters ?? 0) * (priceConfig.water_per_liter ?? 0);
  total_cost += (body.energy_kw ?? 0) * (priceConfig.energy_per_kw ?? 0);
  total_cost += (body.salt_kg ?? 0) * (priceConfig.salt_per_kg ?? 0);
  total_cost += (body.flock_kg ?? 0) * (priceConfig.flock_per_kg ?? 0);
  total_cost += (body.cloth_units ?? 0) * (priceConfig.cloth_per_unit ?? 0);

  const chemPrices = priceConfig.chemicals ?? [];
  for (const usage of body.chemical_usages ?? []) {
    const cp = chemPrices.find((c) => c.name === usage.name);
    if (cp) total_cost += (usage.amount ?? 0) * (cp.price_per_unit ?? 0);
  }

  return Math.round(total_cost * 100) / 100;
}
