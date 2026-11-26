import type { NextConfig } from "next";

// GitHub Pages serves this project from https://<user>.github.io/<repo>/, so the deploy workflow sets
// GITHUB_PAGES=true to build a static export under that path. Local dev and ordinary builds are unaffected.
const repository = "Personal_Web_KORSTYLE";
const forPages = process.env.GITHUB_PAGES === "true";
const basePath = forPages ? `/${repository}` : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plain <a href="/file"> links are not prefixed automatically; content reads this to build them.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(forPages
    ? {
      output: "export" as const,
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
    : {}),
};

export default nextConfig;
