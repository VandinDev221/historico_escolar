/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl.replace(/\/$/, '')}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
