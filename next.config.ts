import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  sassOptions: {
    includePaths: ['./styles'],
    silenceDeprecations: ['legacy-js-api'],
  },
  async headers() {
    return [
      {
        source: '/docs/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
