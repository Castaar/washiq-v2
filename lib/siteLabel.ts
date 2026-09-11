interface SiteLike {
  location: string;
  siteType?: 'wasstraat' | 'selfcarwash';
}

// Selfcarwash locations share a city name with the regular wasstraat there
// (e.g. both show up as "Ninove"), which makes them indistinguishable in the
// site picker — prefix selfcarwash entries so they read as "Self - Ninove".
export function siteLabel(site: SiteLike | undefined): string {
  if (!site) return '—';
  return site.siteType === 'selfcarwash' ? `Self - ${site.location}` : site.location;
}
