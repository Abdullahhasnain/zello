/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Opt-in via env (set in the Dockerfile) — see apps/dashboard/next.config.mjs.
  output: process.env.NEXT_OUTPUT_STANDALONE ? "standalone" : undefined,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.amazonaws.com" }],
  },
  async headers() {
    return [
      {
        // Internal tool: locked down harder than the customer-facing dashboard.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
