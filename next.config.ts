import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: true,
  reloadOnOnline: true,
  additionalPrecacheEntries: [{ url: "/~offline", revision: "offline-fallback" }],
});

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default withSerwist(nextConfig);
