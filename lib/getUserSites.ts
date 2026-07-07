import type { Types } from 'mongoose';

interface RawSiteDoc {
  _id: Types.ObjectId | { toString(): string };
  name?: unknown;
  location?: unknown;
}

export interface SiteOption {
  id: string;
  name: string;
  location: string;
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
