const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const serverActionOrigins = appUrl
  ? [new URL(appUrl).host]
  : ["localhost:3000"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is what the Docker runtime stage consumes, but its
  // build-trace copy step requires symlink permissions Windows dev machines
  // typically lack — so it's opt-in via env (set in the Dockerfile) rather
  // than unconditional.
  output: process.env.NEXT_OUTPUT_STANDALONE ? "standalone" : undefined,
  experimental: {
    serverActions: {
      allowedOrigins: serverActionOrigins,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.zello.ai" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
