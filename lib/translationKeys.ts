import { ChemicalStock, WashProgram, MaintenanceTask, Translation } from '@/lib/models';
import nlMessages from '@/messages/nl.json';

export interface TranslationRow {
  key: string;
  section: string;
  nl: string;
  fr: string;
}

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (obj !== undefined && obj !== null) {
    out[prefix] = String(obj);
  }
  return out;
}

const SECTION_LABELS: Record<string, string> = {
  product: 'Producten',
  program: "Wasprogramma's",
  task: 'Onderhoudstaken',
  nav: 'App — navigatie',
  login: 'App — inlogscherm',
  taal: 'App — taal',
};

function sectionFor(key: string): string {
  const prefix = key.split('.')[0];
  return SECTION_LABELS[prefix] ?? prefix;
}

/** Every translatable key in the app right now: static UI copy + live dynamic content. */
export async function getAllTranslationRows(): Promise<TranslationRow[]> {
  const overrides = await Translation.find({ locale: 'fr' }).select('key value').lean();
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.key as string, o.value as string]));

  const rows: TranslationRow[] = [];

  const nlFlat = flatten(nlMessages);
  for (const key of Object.keys(nlFlat).sort()) {
    rows.push({ key, section: sectionFor(key), nl: nlFlat[key], fr: overrideMap[key] ?? '' });
  }

  const [productNames, programNames, taskDescriptions] = await Promise.all([
    ChemicalStock.distinct('name'),
    WashProgram.distinct('name'),
    MaintenanceTask.distinct('description'),
  ]);

  function addDynamic(prefix: string, names: string[]) {
    for (const name of [...new Set(names)].sort()) {
      const key = `${prefix}.${name}`;
      rows.push({ key, section: sectionFor(key), nl: name, fr: overrideMap[key] ?? '' });
    }
  }
  addDynamic('product', productNames as string[]);
  addDynamic('program', programNames as string[]);
  addDynamic('task', taskDescriptions as string[]);

  return rows;
}
