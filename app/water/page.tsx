import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Types } from 'mongoose';
import { getLocale, getTranslations } from 'next-intl/server';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { WaterCharts } from '@/components/water/WaterCharts/WaterCharts';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import { addDays, brusselsDay } from '@/lib/integrations';
import { hasWaterMeter, waterOverview } from '@/lib/water';
import styles from './page.module.scss';

const MONTH = /^\d{4}-\d{2}$/;

export default async function WaterPage({ searchParams }: { searchParams: Promise<{ site?: string; m?: string }> }) {
  const { site, m } = await searchParams;
  await dbConnect();
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) redirect('/');
  const t = await getTranslations('water');
  const locale = await getLocale();
  const loc = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const cookieSite = (await cookies()).get('glosiv_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location site_type').lean(),
    User.findById(session.userId).select('site_ids role').lean(),
  ]);
  const userRole = (userDoc?.role as string) ?? session.role;
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/water', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const today = brusselsDay(new Date());
  const month = m && MONTH.test(m) ? m : today.slice(0, 7);
  const [y, mo] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const to = monthEnd < today ? monthEnd : addDays(today, -1);
  const prevMonth = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const monthLabel = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const meter = siteId ? await hasWaterMeter(siteId) : false;
  const ov = siteId && meter && to >= monthStart ? await waterOverview(siteId, monthStart, to) : null;

  const L = (n: number) => `${Math.round(n).toLocaleString(loc)} L`;
  const M3 = (n: number) => `${(n / 1000).toLocaleString(loc, { maximumFractionDigits: 1 })} m³`;
  const EUR = (n: number) => `€ ${n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
  const fmtDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
  const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' });

  // Busiest hour outside opening hours (where osmosis / softener / leak shows up)
  const nightPeakHour = ov ? ov.nightLiters.reduce((best, v, h, arr) => (v > arr[best] ? h : best), 0) : 0;

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('titel', { site: siteName })}</h1>
            <div className={styles.monthNav}>
              <Link href={`/water?site=${siteId}&m=${prevMonth}`} className={styles.navBtn}>‹</Link>
              <span className={styles.monthLabel}>{monthLabel}</span>
              {nextMonth <= today.slice(0, 7) ? <Link href={`/water?site=${siteId}&m=${nextMonth}`} className={styles.navBtn}>›</Link> : <span className={styles.navBtnOff}>›</span>}
            </div>
          </div>

          {!meter ? (
            <p className={styles.muted}>
              {t.rich('geenMeter', { link: (c) => <Link href={`/instellingen?site=${siteId}`}>{c}</Link> })}
            </p>
          ) : !ov || ov.measuredDays === 0 ? (
            <p className={styles.muted}>{t('geenData')}</p>
          ) : (
            <>
              {ov.firstMeasured && ov.firstMeasured > monthStart && (
                <p className={styles.note}>{t('meetSinds', { date: fmtDay(ov.firstMeasured) })}</p>
              )}

              <div className={styles.tiles}>
                <div className={styles.tile}><span className={styles.tileLabel}>{t('totaal')}</span><span className={styles.tileValue}>{M3(ov.total)}</span><span className={styles.tileSub}>{t('dagenGemeten', { count: ov.measuredDays })}</span></div>
                <div className={styles.tile}><span className={styles.tileLabel}>{t('kost')}</span><span className={styles.tileValue}>{EUR(ov.cost)}</span><span className={styles.tileSub}>{t('perM3', { prijs: EUR(ov.pricePerM3) })}</span></div>
                <div className={styles.tile}><span className={styles.tileLabel}>{t('gemPerDag')}</span><span className={styles.tileValue}>{L(ov.avgPerDay)}</span>{ov.peakDay && <span className={styles.tileSub}>{t('piek', { date: fmtDay(ov.peakDay.date), liters: L(ov.peakDay.total) })}</span>}</div>
                <div className={styles.tile}><span className={styles.tileLabel}>{t('tijdensOpening')}</span><span className={styles.tileValue}>{L(ov.open)}</span><span className={styles.tileSub}>{pct(ov.open, ov.total)}</span></div>
                <div className={[styles.tile, ov.closed > 0 ? styles.tileWarn : ''].join(' ')}><span className={styles.tileLabel}>{t('buitenOpening')}</span><span className={styles.tileValue}>{L(ov.closed)}</span><span className={styles.tileSub}>{pct(ov.closed, ov.total)}</span></div>
                <div className={[styles.tile, ov.leak > 0 ? styles.tileAlert : ''].join(' ')}><span className={styles.tileLabel}>{t('lek')}</span><span className={styles.tileValue}>{L(ov.leak)}</span><span className={styles.tileSub}>{t('volgensShayp')}</span></div>
              </div>

              <div className={styles.explain}>
                <h2 className={styles.subtitle}>{t('buitenUitlegTitel')}</h2>
                <p className={styles.muted}>{t('buitenUitleg')}</p>
                <p className={styles.verdict}>
                  {ov.closed === 0
                    ? t('verdictNul')
                    : ov.closed < ov.total * 0.05 && ov.closed < 50 * ov.measuredDays
                      ? t('verdictKlein', { liters: L(ov.closed), pct: pct(ov.closed, ov.total), uur: `${String(nightPeakHour).padStart(2, '0')}:00` })
                      : t('verdictWel', { liters: L(ov.closed), pct: pct(ov.closed, ov.total), uur: `${String(nightPeakHour).padStart(2, '0')}:00` })}
                  {ov.leak > 0 && ` ${t('verdictLek', { liters: L(ov.leak) })}`}
                </p>
              </div>

              <WaterCharts
                days={ov.days.map((d) => ({ label: fmtDay(d.date), open: d.open, closed: d.closed }))}
                hourly={ov.avgHourly}
              />

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('kolDag')}</th>
                      <th>{t('kolOpen')}</th>
                      <th className={styles.num}>{t('kolTijdens')}</th>
                      <th className={styles.num}>{t('kolBuiten')}</th>
                      <th className={styles.num}>{t('kolLek')}</th>
                      <th className={styles.num}>{t('kolTotaal')}</th>
                      <th className={styles.num}>{t('kolKost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...ov.days].reverse().map((d) => (
                      <tr key={d.date}>
                        <td>{weekday(d.date)} {fmtDay(d.date)}</td>
                        <td className={styles.muted}>
                          {String(d.openFrom).padStart(2, '0')}–{String(d.openTo).padStart(2, '0')}u{!d.fromLogboek && ` (${t('standaard')})`}
                        </td>
                        <td className={styles.num}>{L(d.open)}</td>
                        <td className={[styles.num, d.closed > 0 ? styles.warn : ''].join(' ')}>{L(d.closed)}</td>
                        <td className={[styles.num, d.leak > 0 ? styles.alert : ''].join(' ')}>{L(d.leak)}</td>
                        <td className={styles.num}><strong>{L(d.total)}</strong></td>
                        <td className={styles.num}>{EUR(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.muted}>{t('voetnoot')}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
