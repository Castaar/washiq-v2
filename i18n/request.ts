import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { dbConnect } from '@/lib/db/mongoose';
import { Translation } from '@/lib/models';

export const SUPPORTED_LOCALES = ['nl', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'nl';
export const LOCALE_COOKIE = 'dodane_locale';

function setByPath(obj: Record<string, unknown>, path: string, value: string) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== 'object' || cur[part] === null) cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;

  // Apply any runtime translation overrides on top of the committed JSON
  // (e.g. from the developer CSV-import tool), without needing a redeploy.
  try {
    await dbConnect();
    const overrides = await Translation.find({ locale }).select('key value').lean();
    for (const o of overrides) setByPath(messages, o.key as string, o.value as string);
  } catch {
    // DB unavailable — fall back to the committed JSON as-is.
  }

  return { locale, messages };
});
