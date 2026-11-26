import type { NextConfig } from "next";

// GitHub Pages serves this repository (named <user>.github.io) from the site root, so the deploy workflow sets
// GITHUB_PAGES=true to build a static export. If the site ever moves under a sub-path (a project site such as
// https://<user>.github.io/<repo>/), set PAGES_BASE_PATH to that path in the workflow. Local dev and ordinary
// builds are unaffected.
const forPages = process.env.GITHUB_PAGES === "true";
const basePath = forPages ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plain <a href="/file"> links are not prefixed automatically; content reads this to build them.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(forPages
    ? {
      output: "export" as const,
      ...(basePath ? { basePath } : {}),
      trailingSlash: true,
      images: { unoptimized: true },
    }
    : {}),
};

export default nextConfig;
