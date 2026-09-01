import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { OrdersPanel } from '@/components/orders/OrdersPanel/OrdersPanel';
import type { OrderItemData, OrderRequestData } from '@/components/orders/OrdersPanel/OrdersPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, OrderItem, OrderRequest } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();

  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? undefined);
  redirectWithSiteParam('/orders', { site }, siteId ?? '');

  const canManage = userRole === 'owner' || userRole === 'developer';

  const [itemDocs, requestDocs] = await Promise.all([
    OrderItem.find({ site_id: siteId, is_active: true }).sort({ name: 1 }).lean(),
    canManage
      ? OrderRequest.find({ site_id: siteId }).sort({ requested_at: -1 }).limit(50).lean()
      : Promise.resolve([]),
  ]);

  const items: OrderItemData[] = itemDocs.map((d) => ({
    id: (d._id as Types.ObjectId).toString(),
    name: d.name as string,
    description: (d.description as string) ?? '',
  }));

  const requests: OrderRequestData[] = requestDocs.map((d) => ({
    id: (d._id as Types.ObjectId).toString(),
    item_name: d.item_name as string,
    requested_by_name: d.requested_by_name as string,
    requested_at: (d.requested_at as Date).toISOString(),
    is_handled: d.is_handled as boolean,
    handled_by_name: (d.handled_by_name as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <OrdersPanel siteId={siteId} initialItems={items} initialRequests={requests} canManage={canManage} />
        </div>
      </main>
    </div>
  );
}
