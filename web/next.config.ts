import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // node-pty is native and must not be bundled by webpack
  serverExternalPackages: ['node-pty'],
};

export default nextConfig;
