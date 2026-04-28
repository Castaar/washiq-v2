/**
 * GET /api/ranking?siteId=...
 *
 * Returns ranking and historical consumption data for all sites
 * owned by the same owner as the given siteId.
 * Accessible by owner and developer roles only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WeeklyEntry, PriceConfig } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'owner' && session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Find current site and its owner
  const currentSite = await Site.findById(siteId).select('owner_id name location').lean();
  if (!currentSite) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  if (!currentSite.owner_id) {
    return NextResponse.json({ sites: [], currentSite: { id: siteId, rank: 1 }, history: [], totalSites: 1, singleSite: true });
  }

  // Get all sites under the same owner
  const ownerSites = await Site.find({ owner_id: currentSite.owner_id }).select('_id name location').lean();

  if (ownerSites.length <= 1) {
    return NextResponse.json({ sites: [], currentSite: { id: siteId, rank: 1 }, history: [], totalSites: 1, singleSite: true });
  }

  const ownerSiteIds = ownerSites.map((s) => (s._id as Types.ObjectId).toString());

  // Fetch last 8 weekly entries per site + latest price config per site in parallel
  const [allEntries, priceConfigs] = await Promise.all([
    WeeklyEntry.find({ site_id: { $in: ownerSiteIds } })
      .sort({ week_start: -1 })
      .limit(ownerSiteIds.length * 8)
      .lean(),
    Promise.all(
      ownerSiteIds.map((sId) =>
        PriceConfig.find({ site_id: sId }).sort({ valid_from: -1 }).limit(1).lean(),
      ),
    ),
  ]);

  // Group entries by site (max 8 per site)
  const entriesBySite: Record<string, typeof allEntries> = {};
  for (const sId of ownerSiteIds) {
    entriesBySite[sId] = allEntries
      .filter((e) => e.site_id.toString() === sId)
      .slice(0, 8);
  }

  // Map price configs by site
  const priceConfigBySite: Record<string, (typeof priceConfigs)[0][0] | null> = {};
  ownerSiteIds.forEach((sId, i) => {
    priceConfigBySite[sId] = priceConfigs[i][0] ?? null;
  });

  // Compute current-period aggregate (last entry = most recent week)
  function getLatestAggregate(siteIdKey: string) {
    const entry = entriesBySite[siteIdKey]?.[0];
    if (!entry) return null;
    return {
      water_liters: entry.water_liters ?? 0,
      energy_kw: entry.energy_kw ?? 0,
      salt_kg: entry.salt_kg ?? 0,
      flock_kg: entry.flock_kg ?? 0,
      wagens: entry.program_counts?.reduce((s: number, p: { count?: number }) => s + (p.count ?? 0), 0) ?? 0,
    };
  }

  // Build site stats
  const siteStats = ownerSites.map((site) => {
    const sId = (site._id as Types.ObjectId).toString();
    const agg = getLatestAggregate(sId);
    const price = priceConfigBySite[sId];

    return {
      id: sId,
      name: site.name as string,
      location: site.location as string,
      rank: 0, // filled below
      metrics: agg
        ? {
            water: agg.water_liters,
            energy: agg.energy_kw,
            salt: agg.salt_kg,
            flock: agg.flock_kg,
            wagens: agg.wagens,
            waterCost: price ? Math.round(agg.water_liters * (price.water_per_liter ?? 0) * 100) / 100 : 0,
            energyCost: price ? Math.round(agg.energy_kw * (price.energy_per_kw ?? 0) * 100) / 100 : 0,
            saltCost: price ? Math.round(agg.salt_kg * (price.salt_per_kg ?? 0) * 100) / 100 : 0,
            flockCost: price ? Math.round(agg.flock_kg * (price.flock_per_kg ?? 0) * 100) / 100 : 0,
          }
        : null,
    };
  });

  // Rank by wagens (most = best = rank 1)
  const sorted = [...siteStats].sort((a, b) => (b.metrics?.wagens ?? 0) - (a.metrics?.wagens ?? 0));
  sorted.forEach((s, i) => {
    const orig = siteStats.find((x) => x.id === s.id);
    if (orig) orig.rank = i + 1;
  });

  const currentRank = siteStats.find((s) => s.id === siteId)?.rank ?? 1;

  // Build historical data per site (chronological order)
  const history = ownerSites.map((site) => {
    const sId = (site._id as Types.ObjectId).toString();
    const entries = [...(entriesBySite[sId] ?? [])].reverse(); // oldest first
    const price = priceConfigBySite[sId];

    return {
      siteId: sId,
      siteName: site.name as string,
      weeks: entries.map((e) => ({
        weekStart: (e.week_start as Date).toISOString(),
        water: e.water_liters ?? 0,
        energy: e.energy_kw ?? 0,
        salt: e.salt_kg ?? 0,
        flock: e.flock_kg ?? 0,
        cloth: (e as Record<string, unknown>).cloth_units as number ?? 0,
        wagens: e.program_counts?.reduce((s: number, p: { count?: number }) => s + (p.count ?? 0), 0) ?? 0,
        waterCost: price ? Math.round((e.water_liters ?? 0) * (price.water_per_liter ?? 0) * 100) / 100 : 0,
        energyCost: price ? Math.round((e.energy_kw ?? 0) * (price.energy_per_kw ?? 0) * 100) / 100 : 0,
        saltCost: price ? Math.round((e.salt_kg ?? 0) * (price.salt_per_kg ?? 0) * 100) / 100 : 0,
        flockCost: price ? Math.round((e.flock_kg ?? 0) * (price.flock_per_kg ?? 0) * 100) / 100 : 0,
      })),
    };
  });

  return NextResponse.json({
    sites: siteStats,
    currentSite: { id: siteId, rank: currentRank },
    history,
    totalSites: ownerSites.length,
  });
}
