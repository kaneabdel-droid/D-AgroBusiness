import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Import CSV des barèmes de retenue à la source (fichier de plusieurs Mo)
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
