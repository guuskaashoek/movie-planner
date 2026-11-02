import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The app never uses next/image, so switch the optimizer off: /_next/image
  // then answers 404 instead of letting anonymous visitors run sharp resizes.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
