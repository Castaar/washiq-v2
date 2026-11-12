import type { Types } from 'mongoose';
import { IntegrationConnection, IntegrationDay, SiteIntegration, type IntegrationProvider } from '@/lib/models';
import { open } from '@/lib/secret-box';
import { brusselsInstant } from '@/lib/dates';

// External data sources a carwash can opt into (Instellingen → Koppelingen):
// - mycarwash: Total Wash / MyCarwash integration API — wash counters per program per day.
//   Counters are day counters that start at 0 each day, so a finished day is final.
// - shayp: Shayp water meter — water consumption per day.
// A nightly cron stores one IntegrationDay per site/provider/day; the ingave sums
// the days of its period to prefill wagens per program and water.

export const PROVIDERS: IntegrationProvider[] = ['mycarwash', 'shayp'];
export const SHAYP_DEFAULT_URL = 'https://shayp.backend.shayp.io';
const TIMEOUT_MS = 20_000;

export interface ConnectionLike {
  provider: IntegrationProvider;
  base_url: string;
  username: string;
  customer_id: string;
  secret_enc: string;
}

export interface ExternalTarget { id: string; name: string; detail?: string }

function trimUrl(u: string): string {
  return u.trim().replace(/\/+$/, '');
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(`Geen toegang (HTTP ${res.status}) — controleer de gegevens`);
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Onverwacht antwoord (geen JSON)');
  }
}

// ── MyCarwash / Total Wash ────────────────────────────────────

async function mycarwashToken(c: ConnectionLike, secret: string): Promise<string> {
  const j = await fetchJson(`${trimUrl(c.base_url)}/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: c.username, password: secret }),
  });
  const token = typeof j === 'string' ? j : (j as { token?: string } | null)?.token;
  if (!token) throw new Error('Inloggen mislukt — controleer gebruikersnaam en wachtwoord');
  return token.replace(/^Bearer\s+/i, '');
}

interface McCounters { success?: boolean; remark?: string; counters?: { number: number; name: string; controllerCounter: number; posCounter: number }[] }

async function mycarwashGet<T>(c: ConnectionLike, token: string, path: string): Promise<T> {
  return (await fetchJson(`${trimUrl(c.base_url)}${path}`, { headers: { Authorization: `Bearer ${token}` } })) as T;
}

// ── Shayp ─────────────────────────────────────────────────────

function shaypBase(c: ConnectionLike): string {
  return `${trimUrl(c.base_url || SHAYP_DEFAULT_URL)}/public/api/v1/customers/${encodeURIComponent(c.customer_id.trim())}`;
}

async function shaypGet<T>(c: ConnectionLike, secret: string, path: string): Promise<T> {
  return (await fetchJson(`${shaypBase(c)}${path}`, { headers: { Authorization: `APIKey ${secret}` } })) as T;
}

// ── Common ────────────────────────────────────────────────────

function secretOf(c: ConnectionLike): string {
  if (!c.secret_enc) throw new Error('Geen wachtwoord / API-sleutel opgeslagen');
  return open(c.secret_enc);
}

// Locations (mycarwash) or water meters (shayp) available on a connection.
// Doubles as the connection test.
export async function discoverTargets(c: ConnectionLike): Promise<ExternalTarget[]> {
  const secret = secretOf(c);
  if (c.provider === 'mycarwash') {
    const token = await mycarwashToken(c, secret);
    const j = await mycarwashGet<{ locations?: { externalId: number; code?: string; description?: string; city?: string }[] }>(c, token, '/api/v1/transactions/locations');
    return (j.locations ?? []).map((l) => ({ id: String(l.externalId), name: l.description || `#${l.externalId}`, detail: [l.code, l.city].filter(Boolean).join(' · ') }));
  }
  const out: ExternalTarget[] = [];
  let path: string | null = '/devices/?limit=100';
  for (let page = 0; path && page < 10; page++) {
    const j: { results?: { id: string; shaypId?: string; description?: string; account?: { name?: string } }[]; next?: string | null } =
      await shaypGet(c, secret, path);
    for (const d of j.results ?? []) out.push({ id: d.id, name: d.description || d.shaypId || d.id, detail: [d.shaypId, d.account?.name].filter(Boolean).join(' · ') });
    path = j.next ? j.next.slice(j.next.indexOf('/devices/')) : null;
  }
  return out;
}

// Program counters reported for one location and day (mycarwash only).
export async function mycarwashCountersFor(c: ConnectionLike, locationId: string, day: string) {
  const token = await mycarwashToken(c, secretOf(c));
  const j = await mycarwashGet<McCounters>(c, token, `/api/v1/transactions/counters/${encodeURIComponent(locationId)}?date=${day}`);
  return (j.counters ?? []).map((x) => ({ number: x.number, name: x.name ?? '', controller: x.controllerCounter ?? 0, pos: x.posCounter ?? 0 }));
}

// ── Days ──────────────────────────────────────────────────────

export function brusselsDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Days after `from` up to and including `to` (YYYY-MM-DD)
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = addDays(from, 1); d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

type LinkDoc = {
  _id: Types.ObjectId;
  site_id: Types.ObjectId;
  provider: IntegrationProvider;
  connection_id: Types.ObjectId;
  external_id: string;
};

// Fetch and store the given (finished) days for one site link. Returns how many were stored.
export async function syncDays(link: LinkDoc, days: string[]): Promise<number> {
  if (days.length === 0 || !link.external_id) return 0;
  const conn = await IntegrationConnection.findById(link.connection_id).lean<ConnectionLike & { _id: Types.ObjectId }>();
  if (!conn) throw new Error('Koppeling niet gevonden');
  const secret = secretOf(conn);
  const upsert = (date: string, set: Record<string, unknown>) =>
    IntegrationDay.updateOne(
      { site_id: link.site_id, provider: link.provider, date },
      { $set: { ...set, fetched_at: new Date() } },
      { upsert: true },
    );

  let stored = 0;
  if (link.provider === 'mycarwash') {
    const token = await mycarwashToken(conn, secret);
    for (const date of days) {
      const j = await mycarwashGet<McCounters>(conn, token, `/api/v1/transactions/counters/${encodeURIComponent(link.external_id)}?date=${date}`);
      const counters = (j.counters ?? []).map((x) => ({ number: x.number, name: x.name ?? '', controller: x.controllerCounter ?? 0, pos: x.posCounter ?? 0 }));
      await upsert(date, { counters });
      stored++;
    }
  } else {
    // One timeseries call for the whole range, summed per Brussels day.
    // Shayp only answers for ranges that ended at least 12 hours ago: skip days that
    // closed more recently (they are fetched on a later run).
    const cutoff = Date.now() - 12 * 36e5;
    const sorted = [...days].sort().filter((d) => brusselsInstant(addDays(d, 1), '00:00:00').getTime() <= cutoff);
    if (sorted.length === 0) return 0;
    const perDay = new Map<string, number>(sorted.map((d) => [d, 0]));
    // Shayp allows at most 7 days per request
    for (let i = 0; i < sorted.length; i += 7) {
      const chunk = sorted.slice(i, i + 7);
      const qs = new URLSearchParams({ start: `${chunk[0]}T00:00:00`, end: `${addDays(chunk[chunk.length - 1], 1)}T00:00:00`, timezone: 'Europe/Brussels' });
      const series = await shaypGet<{ timestamp: string; consumption: number }[]>(conn, secret, `/devices/${encodeURIComponent(link.external_id)}/consumptions/timeseries/?${qs}`);
      for (const p of Array.isArray(series) ? series : []) {
        // Buckets come back in the requested timezone (Brussels) although they carry a
        // "Z": the 00:00 bucket is local midnight. So read the day straight from the text.
        const day = String(p.timestamp).slice(0, 10);
        if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + (Number(p.consumption) || 0));
      }
    }
    for (const [date, liters] of perDay) {
      await upsert(date, { water_liters: Math.round(liters) });
      stored++;
    }
  }
  await SiteIntegration.updateOne({ _id: link._id }, { $set: { last_synced_at: new Date(), last_error: '' } });
  await IntegrationConnection.updateOne({ _id: conn._id }, { $set: { last_ok_at: new Date(), last_error: '' } });
  return stored;
}

// Store any finished day in (from, to] that is not stored yet (max `limit` days).
export async function fillMissingDays(link: LinkDoc, from: string, to: string, limit = 62): Promise<void> {
  const yesterday = addDays(brusselsDay(new Date()), -1);
  const wanted = daysBetween(from, to < yesterday ? to : yesterday).slice(-limit);
  if (wanted.length === 0) return;
  const have = new Set(
    (await IntegrationDay.find({ site_id: link.site_id, provider: link.provider, date: { $in: wanted } }).select('date').lean()).map((d) => d.date as string),
  );
  const missing = wanted.filter((d) => !have.has(d));
  if (missing.length === 0) return;
  try {
    await syncDays(link, missing);
  } catch (err) {
    await SiteIntegration.updateOne({ _id: link._id }, { $set: { last_error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }
}

// ── Access ────────────────────────────────────────────────────

interface SessionLike { userId: string; role: string; siteIds: string[] }

// Connections a user may see and use: developers all; owners their own plus those
// already linked to one of their carwashes.
export async function visibleConnectionIds(session: SessionLike): Promise<Types.ObjectId[] | null> {
  if (session.role === 'developer') return null; // null = no restriction
  const [own, linked] = await Promise.all([
    IntegrationConnection.find({ owner_id: session.userId }).select('_id').lean(),
    SiteIntegration.find({ site_id: { $in: session.siteIds } }).select('connection_id').lean(),
  ]);
  return [...own.map((c) => c._id as Types.ObjectId), ...linked.map((l) => l.connection_id as Types.ObjectId)];
}

export async function canUseConnection(session: SessionLike, connectionId: string): Promise<boolean> {
  const ids = await visibleConnectionIds(session);
  return ids === null || ids.some((id) => String(id) === connectionId);
}

export function publicConnection(c: {
  _id: unknown; provider: IntegrationProvider; label?: string; base_url?: string; username?: string;
  customer_id?: string; last_ok_at?: Date | null; last_error?: string; owner_id?: unknown;
}) {
  return {
    id: String(c._id),
    provider: c.provider,
    label: c.label ?? '',
    baseUrl: c.base_url ?? '',
    username: c.username ?? '',
    customerId: c.customer_id ?? '',
    lastOkAt: c.last_ok_at ? c.last_ok_at.toISOString() : null,
    lastError: c.last_error ?? '',
    ownerId: String(c.owner_id ?? ''),
  };
}
