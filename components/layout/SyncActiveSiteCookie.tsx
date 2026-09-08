'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

// Deep links (push notifications, shared URLs) carry ?site=<id> but never
// go through the SiteSelector's onChange, so dodane_active_site never gets
// set/updated — leaving the root layout's nav (which only trusts the
// cookie) showing the previous site's type/links. Sync it here and force
// a refresh so the nav catches up immediately instead of one nav later.
export function SyncActiveSiteCookie() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const siteId = searchParams.get('site');
    if (!siteId) return;
    if (getCookie('dodane_active_site') === siteId) return;
    document.cookie = `dodane_active_site=${siteId}; path=/; max-age=2592000; SameSite=Lax`;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
