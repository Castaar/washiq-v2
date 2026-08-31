import { dbConnect } from '@/lib/db/mongoose';
import { Translation } from '@/lib/models';

export type TranslationMap = Record<string, string>;

/** All runtime translation overrides for a locale, as a flat key->value map. */
export async function getTranslationMap(locale: string): Promise<TranslationMap> {
  if (locale === 'nl') return {};
  await dbConnect();
  const docs = await Translation.find({ locale }).select('key value').lean();
  return Object.fromEntries(docs.map((d) => [d.key as string, d.value as string]));
}

/**
 * Translate a piece of dynamic content (product name, wasprogramma naam,
 * onderhoudstaak omschrijving, ...) using the override map. Falls back to
 * the Dutch original when no translation was provided.
 */
export function translateContent(map: TranslationMap, prefix: string, value: string): string {
  return map[`${prefix}.${value}`] || value;
}
