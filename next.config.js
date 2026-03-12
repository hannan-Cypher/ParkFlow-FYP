/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Enable standalone output for Docker
  output: 'standalone',

  // Allow ngrok tunnel origins in dev mode (prevents cross-origin slowness)
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', '192.168.18.11'],

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