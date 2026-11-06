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
          // Base CSP without script-src (Next inlines scripts without a nonce):
          // no framing, no <base> hijack, no plugins. No form-action: the Google
          // sign-in form redirects to accounts.google.com, which form-action
          // would block in Chromium.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
