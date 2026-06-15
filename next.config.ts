import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "avatars.githubusercontent.com" }],
  },
  devIndicators: false,
};

export default nextConfig;
