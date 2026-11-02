import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { isValidObjectId } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { Site } from '@/lib/models';
import { getSession } from '@/lib/session';
import { buildMonthlyReport, type ReportPerson } from '@/lib/attendance-report';
import { PrintToolbar } from '@/components/logboek/PrintToolbar/PrintToolbar';
import styles from './page.module.scss';

// Printable A4 sheets of the worked hours over all the owner's carwashes for one
// month: a total sheet (with the hours / wasbeurten ratio), or one sheet per person.
// ?view=totaal (default) | alle | <person key>
export default async function AfdrukPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string }>;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) redirect('/logboek');

  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? '') || now.getFullYear();
  const month = Math.min(12, Math.max(1, parseInt(params.month ?? '') || now.getMonth() + 1));

  await dbConnect();
  const siteIds = session.role === 'developer'
    ? (await Site.find({}).select('_id').lean()).map((s) => String(s._id))
    : session.siteIds.filter((id) => isValidObjectId(id));
  const report = await buildMonthlyReport(siteIds, year, month);

  const t = await getTranslations('afdruk');
  const locale = await getLocale();
  const dateLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const monthName = new Intl.DateTimeFormat(dateLocale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 15)));
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const today = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels' }).format(now);
  const hours = (n: number) => n.toLocaleString(dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const count = (n: number) => n.toLocaleString(dateLocale);
  const minutes = (n: number) => (n > 0 ? `${n} min` : '–');
  const day = (d: string) => new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const personName = (p: ReportPerson) => (p.isJobstudent ? `${p.name} (${t('jobstudent')})` : p.name);

  const view = params.view === 'alle' || report.people.some((p) => p.key === params.view) ? params.view! : 'totaal';
  const shownPeople = view === 'alle' ? report.people : report.people.filter((p) => p.key === view);
  const options = [
    { value: 'totaal', label: t('totaalBlad') },
    { value: 'alle', label: t('iedereenApart') },
    ...report.people.map((p) => ({ value: p.key, label: personName(p) })),
  ];

  const header = (subtitle?: string) => (
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/glosiv-logo-dark.svg" alt="Glosiv" className={styles.logo} />
      <div className={styles.headerText}>
        <h1 className={styles.title}>{subtitle ?? t('titel')}</h1>
        <p className={styles.period}>{subtitle ? `${t('titel')} · ` : ''}{t('periode', { maand: monthLabel, jaar: year })}</p>
      </div>
    </header>
  );

  const footer = (missing: boolean, signatures: string[]) => (
    <footer className={styles.footer}>
      <div className={styles.signatures}>
        {signatures.map((s) => <span key={s}>{s}</span>)}
      </div>
      <p>{t('voetnoot')} {missing && t('geenVertrekUitleg')}</p>
      <p>{t('opgemaakt', { datum: today })} · {t('gemaaktMet')}</p>
    </footer>
  );

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <PrintToolbar
          year={year}
          month={month}
          view={view}
          options={options}
          printLabel={t('afdrukken')}
          chooseLabel={t('kies')}
        />
      </div>

      {view === 'totaal' && (
        <article className={styles.sheet}>
          {header()}

          <dl className={styles.meta}>
            <div>
              <dt>{t('carwashes')}</dt>
              <dd>{report.sites.join(' · ') || '–'}</dd>
            </div>
            <div>
              <dt>{t('totaalIedereen')}</dt>
              <dd className={styles.metaStrong}>{hours(report.totalHours)} u</dd>
            </div>
          </dl>

          {report.people.length === 0 ? (
            <p className={styles.empty}>{t('geenGegevens')}</p>
          ) : (
            <>
              <h2 className={styles.sectionTitle}>{t('overzicht')}</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('medewerker')}</th>
                    {report.sites.map((s) => <th key={s} className={styles.num}>{s}</th>)}
                    <th className={styles.num}>{t('dagen')}</th>
                    <th className={styles.num}>{t('totaal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.people.map((p) => (
                    <tr key={p.key}>
                      <td>{personName(p)}</td>
                      {report.sites.map((s) => {
                        const h = p.perSite.find((x) => x.site === s)?.hours ?? 0;
                        return <td key={s} className={styles.num}>{h > 0 ? hours(h) : '–'}</td>;
                      })}
                      <td className={styles.num}>{p.daysWorked}</td>
                      <td className={`${styles.num} ${styles.strong}`}>{hours(p.totalHours)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('totaalIedereen')}</td>
                    {report.siteStats.map((s) => <td key={s.site} className={styles.num}>{hours(s.hours)}</td>)}
                    <td />
                    <td className={styles.num}>{hours(report.totalHours)}</td>
                  </tr>
                </tfoot>
              </table>

              <h2 className={`${styles.sectionTitle} ${styles.spaced}`}>{t('ratioTitel')}</h2>
              <table className={`${styles.table} ${styles.ratioTable}`}>
                <thead>
                  <tr>
                    <th>{t('carwash')}</th>
                    <th className={styles.num}>{t('urenGewerkt')}</th>
                    <th className={styles.num}>{t('wasbeurten')}</th>
                    <th className={styles.num}>{t('wasbeurtenPerUur')}</th>
                    <th className={styles.num}>{t('minutenPerWasbeurt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.siteStats.map((s) => (
                    <tr key={s.site}>
                      <td>{s.site}</td>
                      <td className={styles.num}>{hours(s.hours)}</td>
                      <td className={styles.num}>{s.washes > 0 ? count(s.washes) : '–'}</td>
                      <td className={styles.num}>{s.washesPerHour !== null ? hours(s.washesPerHour) : '–'}</td>
                      <td className={styles.num}>{s.minutesPerWash !== null ? hours(s.minutesPerWash) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t('totaalWasstraten')}</td>
                    <td className={styles.num}>{hours(report.washTotals.hours)}</td>
                    <td className={styles.num}>{report.washTotals.washes > 0 ? count(report.washTotals.washes) : '–'}</td>
                    <td className={styles.num}>{report.washTotals.washesPerHour !== null ? hours(report.washTotals.washesPerHour) : '–'}</td>
                    <td className={styles.num}>{report.washTotals.minutesPerWash !== null ? hours(report.washTotals.minutesPerWash) : '–'}</td>
                  </tr>
                </tfoot>
              </table>
              <p className={styles.note}>
                {report.washTotals.washes > 0 ? t('ratioUitleg') : t('geenWasbeurten')}
              </p>
            </>
          )}

          {footer(report.people.some((p) => p.sessions.some((s) => !s.checkOut)), [t('handtekeningWerkgever')])}
        </article>
      )}

      {shownPeople.map((p) => (
        <article key={p.key} className={styles.sheet}>
          {header(personName(p))}

          <dl className={styles.meta}>
            <div>
              <dt>{t('dagen')}</dt>
              <dd className={styles.metaStrong}>{p.daysWorked}</dd>
            </div>
            <div>
              <dt>{t('pauze')}</dt>
              <dd className={styles.metaStrong}>{minutes(p.pauseMinutes)}</dd>
            </div>
            <div>
              <dt>{t('totaal')}</dt>
              <dd className={styles.metaStrong}>{hours(p.totalHours)} u</dd>
            </div>
          </dl>

          {p.perSite.length > 1 && (
            <table className={`${styles.table} ${styles.siteTable}`}>
              <thead>
                <tr>
                  <th>{t('carwash')}</th>
                  <th className={styles.num}>{t('uren')}</th>
                </tr>
              </thead>
              <tbody>
                {p.perSite.map((s) => (
                  <tr key={s.site}>
                    <td>{s.site}</td>
                    <td className={styles.num}>{hours(s.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('datum')}</th>
                <th>{t('carwash')}</th>
                <th>{t('aankomst')}</th>
                <th>{t('vertrek')}</th>
                <th className={styles.num}>{t('pauze')}</th>
                <th className={styles.num}>{t('uren')}</th>
              </tr>
            </thead>
            <tbody>
              {p.sessions.map((s, i) => (
                <tr key={i} className={s.checkOut ? undefined : styles.missing}>
                  <td>{day(s.date)}</td>
                  <td>{s.endSite && s.endSite !== s.site ? `${s.site} → ${s.endSite}` : s.site}</td>
                  <td>{s.checkIn}</td>
                  <td>{s.checkOut || t('geenVertrek')}</td>
                  <td className={styles.num}>{minutes(s.pauseMinutes)}</td>
                  <td className={styles.num}>{s.checkOut ? hours(s.hours) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{t('totaal')}</td>
                <td className={styles.num}>{minutes(p.pauseMinutes)}</td>
                <td className={styles.num}>{hours(p.totalHours)}</td>
              </tr>
            </tfoot>
          </table>

          {footer(p.sessions.some((s) => !s.checkOut), [t('handtekeningWerknemer'), t('handtekeningWerkgever')])}
        </article>
      ))}
    </div>
  );
}
