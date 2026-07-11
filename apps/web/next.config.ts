import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El motor se consume como TypeScript fuente desde el workspace
  transpilePackages: ['@nom35/motor-nom035'],
};

export default nextConfig;
