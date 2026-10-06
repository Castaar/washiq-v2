import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { LeveringenPanel } from '@/components/leveringen/LeveringenPanel/LeveringenPanel';
import type { StockItem } from '@/components/leveringen/LeveringenPanel/LeveringenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import Link from 'next/link';
import { HistoryDeleteButton } from '@/components/leveringen/HistoryDeleteButton/HistoryDeleteButton';
import { canModify } from '@/lib/permissions';
import { Site, ChemicalStock, User, StockDelivery, StockTransfer, StockAdjustment } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function LeveringenPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  await dbConnect();

  const session = await getSession();
  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location site_type').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/leveringen', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const stockDocs = siteId
    ? await ChemicalStock.find({ site_id: siteId }).sort({ name: 1 }).lean()
    : [];

  const stocks: StockItem[] = stockDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: s.name as string,
    current_stock: (s.current_stock as number) ?? 0,
    min_stock_alert: (s.min_stock_alert as number) ?? 0,
    unit: (s.unit as string) ?? '',
  }));

  const [deliveryDocs, transferDocs, adjustmentDocs] = siteId
    ? await Promise.all([
        StockDelivery.find({ site_id: siteId }).sort({ delivered_at: -1 }).limit(60).populate('chemical_id', 'name unit').lean(),
        StockTransfer.find({ $or: [{ from_site_id: siteId }, { to_site_id: siteId }] })
          .sort({ transferred_at: -1 }).limit(60).populate('from_site_id', 'name').populate('to_site_id', 'name').lean(),
        StockAdjustment.find({ site_id: siteId }).sort({ adjusted_at: -1 }).limit(60).populate('chemical_id', 'name unit').lean(),
      ])
    : [[], [], []];

  const canSeeHistoriek = userRole === 'owner' || userRole === 'developer';
  const fmtWhen = (d: Date) => d.toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  const history = [
    ...deliveryDocs.map((d) => {
      const chem = d.chemical_id as unknown as { name?: string; unit?: string } | null;
      return {
        key: `d-${(d._id as Types.ObjectId).toString()}`,
        at: d.delivered_at as Date,
        title: chem?.name ? `Levering: ${chem.name}` : `Levering: ${(d.note as string) || 'diverse'}`,
        detail: chem?.name ? `+${((d.quantity as number) ?? 0).toLocaleString('nl-BE')} ${chem.unit ?? ''}` : '',
        by: (d.logged_by_name as string) || '',
        deleteUrl: canModify(session, d.logged_by) ? `/api/stock/delivery/${(d._id as Types.ObjectId).toString()}` : '',
      };
    }),
    ...transferDocs.map((t) => {
      const from = t.from_site_id as unknown as { _id?: Types.ObjectId; name?: string } | null;
      const to = t.to_site_id as unknown as { name?: string } | null;
      const outgoing = from?._id?.toString() === siteId;
      return {
        key: `t-${(t._id as Types.ObjectId).toString()}`,
        at: t.transferred_at as Date,
        title: outgoing ? `Verplaatst naar ${to?.name ?? '?'}: ${t.name}` : `Ontvangen van ${from?.name ?? '?'}: ${t.name}`,
        detail: `${outgoing ? '−' : '+'}${((t.quantity as number) ?? 0).toLocaleString('nl-BE')} ${t.unit ?? ''}`,
        by: (t.logged_by_name as string) || '',
        deleteUrl: canSeeHistoriek ? `/api/stock/transfer/${(t._id as Types.ObjectId).toString()}` : '',
      };
    }),
    ...adjustmentDocs.map((a) => {
      const chem = a.chemical_id as unknown as { name?: string; unit?: string } | null;
      const q = (a.quantity as number) ?? 0;
      return {
        key: `a-${(a._id as Types.ObjectId).toString()}`,
        at: a.adjusted_at as Date,
        title: `Correctie: ${chem?.name ?? 'product'}`,
        detail: `${q >= 0 ? '+' : '−'}${Math.abs(q).toLocaleString('nl-BE')} ${chem?.unit ?? ''} (telt niet als verbruik)`,
        by: (a.logged_by_name as string) || '',
        deleteUrl: canSeeHistoriek ? `/api/stock/adjustment/${(a._id as Types.ObjectId).toString()}` : '',
      };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);

  const otherSites = allowedSites.filter((s) => s.id !== siteId).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Leveringen — {siteName}</h1>
            <p className={styles.subtitle}>Registreer een levering om de voorraad bij te werken.</p>
          </div>
          <LeveringenPanel key={siteId ?? ''} stocks={stocks} siteId={siteId ?? ''} otherSites={otherSites} />
        </div>

        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Historiek leveringen — {siteName}</h2>
            <p className={styles.subtitle}>
              Alle leveringen (ook diverse zoals een motor) en verplaatsingen.
              {canSeeHistoriek && siteId && (
                <> Corrigeren of verwijderen kan via <Link href={`/historiek?site=${siteId}`}>Historiek → Voorraad</Link>.</>
              )}
            </p>
          </div>
          {history.length === 0 ? (
            <p className={styles.subtitle}>Nog geen leveringen geregistreerd.</p>
          ) : (
            <div className={styles.histList}>
              {history.map((h) => (
                <div key={h.key} className={styles.histRow}>
                  <span className={styles.histTitle}>{h.title}</span>
                  {h.detail && <span className={styles.histDetail}>{h.detail}</span>}
                  <span className={styles.histMeta}>{h.by ? `${h.by} · ` : ''}{fmtWhen(h.at)}</span>
                  {h.deleteUrl && <HistoryDeleteButton url={h.deleteUrl} label={h.title} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
