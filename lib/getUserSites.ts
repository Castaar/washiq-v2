import type { Types } from 'mongoose';
import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig } from '@/lib/models';

interface RawSiteDoc {
  _id: Types.ObjectId | { toString(): string };
  name?: unknown;
  location?: unknown;
  site_type?: unknown;
}

export interface SiteOption {
  id: string;
  name: string;
  location: string;
  siteType: 'wasstraat' | 'selfcarwash';
}

/** Filters a list of all site docs down to only those the user may access. */
export function filterSitesForUser(
  siteDocs: RawSiteDoc[],
  userSiteIds: string[],
  userRole: string,
): SiteOption[] {
  const allowed =
    userRole === 'developer' || userRole === 'technician'
      ? siteDocs
      : siteDocs.filter((s) => userSiteIds.includes(s._id.toString()));

  return allowed.map((s) => ({
    id: s._id.toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
    siteType: (s.site_type as 'wasstraat' | 'selfcarwash') ?? 'wasstraat',
  }));
}

/** Picks the active site from allowed sites, falling back to the first one. */
export function resolveActiveSite(
  allowedSites: SiteOption[],
  requestedSiteId: string | undefined,
): string {
  if (requestedSiteId && allowedSites.find((s) => s.id === requestedSiteId)) {
    return requestedSiteId;
  }
  return allowedSites[0]?.id ?? '';
}

/**
 * Sends owners/developers to the setup wizard whenever the active site hasn't
 * been configured yet — no matter which page they were switching *from* or
 * navigated to directly. Call this right after resolving `siteId` on every
 * page that renders site-scoped data.
 */
export async function redirectIfSetupNeeded(siteId: string, userRole: string): Promise<void> {
  if (!siteId || (userRole !== 'owner' && userRole !== 'developer')) return;

  await dbConnect();
  const siteDoc = await Site.findById(siteId).select('setup_done').lean();
  if (!siteDoc || siteDoc.setup_done) return;

  const existingPrice = await PriceConfig.findOne({ site_id: siteId }).select('_id').lean();
  if (!existingPrice) redirect(`/setup?site=${siteId}`);
}

/**
 * Selfcarwash sites don't track per-program wagen counts — bounces owners/
 * developers away from wagen-only pages (wekelijkse ingave, historiek) back
 * to the dashboard. Call after redirectIfSetupNeeded, with the same siteId.
 */
export async function redirectIfSelfCarwash(siteId: string): Promise<void> {
  if (!siteId) return;
  await dbConnect();
  const siteDoc = await Site.findById(siteId).select('site_type').lean();
  if (siteDoc?.site_type === 'selfcarwash') redirect(`/?site=${siteId}`);
}

/**
 * Makes sure `?site=` is always present in the URL — if the page was loaded
 * without it (first load, a bookmark, a shared link), redirect once to the
 * same URL with the resolved site appended so the address bar always
 * reflects which carwash is active. Any other query params are preserved.
 * No-op if `site` is already set or there's no resolvable site.
 */
export function redirectWithSiteParam(
  pathname: string,
  rawParams: Record<string, string | undefined>,
  siteId: string,
): void {
  if (rawParams.site || !siteId) return;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (value !== undefined) qs.set(key, value);
  }
  qs.set('site', siteId);
  redirect(`${pathname}?${qs.toString()}`);
}
