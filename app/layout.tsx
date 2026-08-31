import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { PwaRegister } from '@/components/layout/PwaRegister';
import PushSetup from '@/components/layout/PushSetup/PushSetup';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { BottomNav } from '@/components/layout/BottomNav/BottomNav';
import { DesktopNav } from '@/components/layout/DesktopNav/DesktopNav';
import { getSession } from '@/lib/session';
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

  return (
    <html lang={locale} className={inter.variable}>
      <body className={session ? 'has-bottom-nav' : ''}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <PwaRegister />
            <PushSetup />
            {children}
            {session && <BottomNav role={session.role} />}
            {session && <DesktopNav role={session.role} />}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
