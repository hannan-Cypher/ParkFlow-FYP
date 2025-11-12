/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Enable standalone output for Docker
  output: 'standalone',
  
  images: {
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
}

module.exports = nextConfig