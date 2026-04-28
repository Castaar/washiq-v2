import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { PwaRegister } from '@/components/layout/PwaRegister';
import PushSetup from '@/components/layout/PushSetup/PushSetup';
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
};

export const viewport: Viewport = {
  themeColor: '#0d0d0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PwaRegister />
        <PushSetup />
        {children}
      </body>
    </html>
  );
}
