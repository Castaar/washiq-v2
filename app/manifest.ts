import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WashIQ — Inventory Suite',
    short_name: 'WashIQ',
    description: 'Carwash dashboard voor stock en verbruiksbeheer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1d1c1a',
    theme_color: '#1d1c1a',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
