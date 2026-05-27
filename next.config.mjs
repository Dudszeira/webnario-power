/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    formats: ['image/webp'],
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    config.cache = false;
    config.snapshot = {
      managedPaths: [],
      immutablePaths: [],
      buildDependencies: { hash: true, timestamp: false },
      module: { hash: true, timestamp: false },
      resolve: { hash: true, timestamp: false },
      resolveBuildDependencies: { hash: true, timestamp: false }
    };
    return config;
  },
};

export default nextConfig;
