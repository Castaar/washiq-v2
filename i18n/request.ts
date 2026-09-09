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

// Deep-merge `overlay` onto `base`, skipping empty-string/null leaves so a
// key that only exists in nl.json (not yet translated) falls back to its
// Dutch value instead of throwing a missing-message error.
function deepMergeFallback(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const overlayVal = overlay[key];
    const baseVal = base[key];
    if (overlayVal && typeof overlayVal === 'object' && !Array.isArray(overlayVal)) {
      out[key] = deepMergeFallback((baseVal as Record<string, unknown>) ?? {}, overlayVal as Record<string, unknown>);
    } else if (overlayVal !== '' && overlayVal !== null && overlayVal !== undefined) {
      out[key] = overlayVal;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;

  const nlMessages = (await import('../messages/nl.json')).default as Record<string, unknown>;
  const merged = locale === 'nl'
    ? nlMessages
    : deepMergeFallback(nlMessages, (await import(`../messages/${locale}.json`)).default as Record<string, unknown>);
  // Deep-clone before mutating with DB overrides below — the JSON imports are
  // cached module singletons, and `merged` can still share nested objects
  // with them (any key not touched by the fr overlay), so writing into it
  // in place would leak fr overrides into the nl locale's cached messages.
  const messages = JSON.parse(JSON.stringify(merged)) as Record<string, unknown>;

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
