import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [
    { protocol: 'https', hostname: 'covers.openlibrary.org' },
  ]}
  
  /* config options here */
};

export default nextConfig;
