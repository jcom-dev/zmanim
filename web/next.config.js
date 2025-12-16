/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for OpenNext/Lambda deployment
  output: 'standalone',
  // Disable React Strict Mode to prevent double mount/unmount cycles in development
  reactStrictMode: false,
}

module.exports = nextConfig
