import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { PwaRegister } from '@/components/layout/PwaRegister';
import PushSetup from '@/components/layout/PushSetup/PushSetup';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { BottomNav } from '@/components/layout/BottomNav/BottomNav';
import { DesktopNav } from '@/components/layout/DesktopNav/DesktopNav';
import { SyncActiveSiteCookie } from '@/components/layout/SyncActiveSiteCookie';
import { getSession } from '@/lib/session';
import { dbConnect } from '@/lib/db/mongoose';
import { Site } from '@/lib/models';
import '../styles/globals.scss';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WashIQ — Inventory Suite',
  description: 'Carwash dashboard voor stock en verbruiksbeheer.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WashIQ',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1d1c1a',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = await getLocale();
  const messages = await getMessages();

  // Resolve the active site's type (wasstraat/selfcarwash) so the nav can
  // hide wagens-only links (Ingave/Historiek) — nav display only, actual
  // route access is enforced per-page via redirectIfSelfCarwash.
  let siteType: 'wasstraat' | 'selfcarwash' = 'wasstraat';
  if (session) {
    const cookieStore = await cookies();
    const activeSiteId = cookieStore.get('dodane_active_site')?.value;
    if (activeSiteId) {
      await dbConnect();
      const siteDoc = await Site.findById(activeSiteId).select('site_type').lean();
      if (siteDoc?.site_type === 'selfcarwash') siteType = 'selfcarwash';
    }
  }

  return (
    <html lang={locale} className={inter.variable}>
      <body className={session ? 'has-bottom-nav' : ''}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <PwaRegister />
            <PushSetup />
            {children}
            {session && <SyncActiveSiteCookie />}
            {session && <BottomNav role={session.role} siteType={siteType} />}
            {session && <DesktopNav role={session.role} siteType={siteType} />}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
