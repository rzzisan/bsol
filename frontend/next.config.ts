import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow Next.js <Image> to optimize images from our own domain
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bsol.zyrotechbd.com",
        pathname: "/storage/**",
      },
    ],
    // Cache optimized images for 1 year on the CDN/proxy
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        // Product media served from Laravel storage (passes through Nginx)
        source: "/storage/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js build artifacts are content-hashed — safe for immutable cache
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js image optimization endpoint
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
