/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    formats: ['image/webp'],
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
