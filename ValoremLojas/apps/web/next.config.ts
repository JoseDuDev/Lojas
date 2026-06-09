import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_CDN_HOSTNAME || 'cdn.valorem.com.br',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
