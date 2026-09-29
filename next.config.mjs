/**
 * STATIC_EXPORT=1 builds a plain static site into out/ (used for GitHub Pages).
 * NEXT_PUBLIC_BASE_PATH is the sub-path the site is served from, e.g. /ShiurDaledMivtoim.
 */
import { writeFileSync } from "node:fs";

const staticExport = process.env.STATIC_EXPORT === "1";

// Every build gets its own id. The site publishes it at version.json so an open
// app can notice a newer version and refresh itself.
const buildId = process.env.GITHUB_SHA || String(Date.now());
if (staticExport) writeFileSync(new URL("./public/version.json", import.meta.url), JSON.stringify({ build: buildId }) + "\n");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
