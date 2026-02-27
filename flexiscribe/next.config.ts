import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── Turbopack (fast local refresh) ────────────────────────────────────────
  // Explicitly set root to this project directory so Turbopack doesn't pick
  // up the stray lockfile at C:\Users\Acer\package-lock.json
  turbopack: {
    root: __dirname,
  },

  // ── Source maps: full in dev, no-op in prod (Vercel handles it) ───────────
  productionBrowserSourceMaps: false,

  // ── Image domains ─────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.vercel.app" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },

  // ── HTTP headers ──────────────────────────────────────────────────────────
  async headers() {
    const allowedOrigins = isDev
      ? "http://localhost:3000"
      : (process.env.NEXT_PUBLIC_APP_URL ?? "");

    return [
      {
        // Apply to all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin",      value: allowedOrigins },
          { key: "Access-Control-Allow-Methods",     value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers",     value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
