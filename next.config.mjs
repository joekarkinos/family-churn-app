/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA config will be added via next-pwa when ready
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
