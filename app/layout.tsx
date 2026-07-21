import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { PwaRegister } from '@/components/layout/PwaRegister';
import PushSetup from '@/components/layout/PushSetup/PushSetup';
import { ToastProvider } from '@/components/ui/Toast/ToastProvider';
import { BottomNav } from '@/components/layout/BottomNav/BottomNav';
import { getSession } from '@/lib/session';
import '../styles/globals.scss';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dodane — Inventory Suite',
  description: 'Carwash dashboard voor stock en verbruiksbeheer.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dodane',
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
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className={inter.variable}>
      <body className={session ? 'has-bottom-nav' : ''}>
        <ToastProvider>
          <PwaRegister />
          <PushSetup />
          {children}
          {session && <BottomNav role={session.role} />}
        </ToastProvider>
      </body>
    </html>
  );
}
