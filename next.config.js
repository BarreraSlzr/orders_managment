/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.ctfassets.net'],
  },
  experimental: { serverActions: { allowedOrigins: [ "localhost:3000", "https://super-trout-v6rpq4v4px43w45g-3000.app.github.dev/", ], }, }
}

module.exports = nextConfig
