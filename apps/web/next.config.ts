import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Quote URLs carry the quote id, which (until there is auth) is enough to read the
        // quote. Never leak it to other sites through the Referer header.
        source: '/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
