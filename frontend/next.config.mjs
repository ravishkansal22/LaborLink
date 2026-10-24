/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;