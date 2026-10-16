// Brush positions a carwash can have, with how many of each can be registered.
export const BRUSH_CATEGORIES = [
  { key: 'dak', label: 'Dakborstel', max: 3 },
  { key: 'verticaal_links', label: 'Verticale borstel links', max: 3 },
  { key: 'verticaal_rechts', label: 'Verticale borstel rechts', max: 3 },
  { key: 'halfhoog_links', label: 'Half hoge verticale borstel links', max: 3 },
  { key: 'halfhoog_rechts', label: 'Half hoge verticale borstel rechts', max: 3 },
  { key: 'wiel_links', label: 'Wielborstel links', max: 3 },
  { key: 'wiel_rechts', label: 'Wielborstel rechts', max: 3 },
  { key: 'droog_horizontaal', label: 'Droogborstel horizontaal', max: 1 },
  { key: 'droog_verticaal_links', label: 'Droogborstel verticaal links', max: 1 },
  { key: 'droog_verticaal_rechts', label: 'Droogborstel verticaal rechts', max: 1 },
] as const;

export type BrushCategory = (typeof BRUSH_CATEGORIES)[number]['key'];

export const BRUSH_CATEGORY_KEYS = BRUSH_CATEGORIES.map((c) => c.key) as BrushCategory[];

export function brushCategoryInfo(key: string) {
  return BRUSH_CATEGORIES.find((c) => c.key === key);
}
