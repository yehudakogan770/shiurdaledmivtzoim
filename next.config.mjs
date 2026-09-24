/**
 * STATIC_EXPORT=1 builds a plain static site into out/ (used for GitHub Pages).
 * NEXT_PUBLIC_BASE_PATH is the sub-path the site is served from, e.g. /ShiurDaledMivtoim.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
};

export default nextConfig;
