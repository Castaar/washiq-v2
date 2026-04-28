import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  sassOptions: {
    includePaths: ['./styles'],
    silenceDeprecations: ['legacy-js-api'],
  },
};

export default nextConfig;
