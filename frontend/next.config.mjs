/** @type {import('next').NextConfig} */
// The browser calls /api/v1/* on this app; Next forwards it to the FastAPI backend, so no CORS
// setup is needed. Point LABORLINK_API_URL elsewhere if the backend isn't on port 8000.
const backendUrl = process.env.LABORLINK_API_URL ?? 'http://127.0.0.1:8000';

const nextConfig = {
  reactStrictMode: true,
  // Lets a second dev server run from the same folder without sharing build output.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
