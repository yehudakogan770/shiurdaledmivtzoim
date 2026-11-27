// Builds the whole app into one self-contained HTML file.
//   node scripts/build-spa.mjs            dist/shiur-daled-mivtzoim.html: a this-device-only copy
//                                         (no database), to open straight from disk.
//   node scripts/build-spa.mjs --app DIR  DIR/app.html + DIR/app.json: the real site, connected to
//                                         the database, for the Android app. The app keeps this
//                                         file inside itself, so it never has to load the website.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appAt = process.argv.indexOf("--app");
const appDir = appAt > 0 ? path.resolve(process.argv[appAt + 1] || "dist") : null;
// The same public values the website is built with (the publishable key is public by design).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fkyzknggspsaeqguendg.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_oIxp_hwqWel4gEPUqUciCg_DZ-0TU5V";
const SITE = "https://sdmivtzoim.com";
const buildId = process.env.GITHUB_SHA || String(Date.now());
const dataUri = async (file, type) => `data:${type};base64,${(await readFile(path.join(root, file))).toString("base64")}`;
const cssFile = path.join(root, "app/globals.css");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(await readFile(cssFile, "utf8"), { from: cssFile });

const result = await build({
  entryPoints: [path.join(root, "spa/main.tsx")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  alias: { "@": root },
  // Any other build-time setting the site asks about is simply "not set" in this one file.
  banner: { js: "var process={env:{}};" },
  define: appDir
    ? {
        "process.env.NODE_ENV": '"production"',
        "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
        "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_KEY),
        "process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY": JSON.stringify(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""),
        "process.env.NEXT_PUBLIC_BASE_PATH": '""',
        // Inside the app the page has no web address of its own; links in emails and invitations use the site's.
        "window.location.origin": JSON.stringify(SITE),
        // Pictures the site loads by address are packed in instead.
        "process.env.NEXT_PUBLIC_MENORAH_SRC": JSON.stringify(await dataUri("public/menorah-770.webp", "image/webp")),
      }
    : {
        "process.env.NODE_ENV": '"production"',
        "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
        "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
      },
  plugins: appDir ? [] : [
    {
      // The single-file build never talks to Supabase; leave the client out.
      name: "no-supabase",
      setup(b) {
        b.onResolve({ filter: /\/supabase$/ }, (args) =>
          args.importer.includes(path.join("lib", "backend")) ? { path: "supabase-stub", namespace: "stub" } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export function createSupabaseBackend() { throw new Error('Supabase is not available in this build'); }",
          loader: "js",
        }));
      },
    },
  ],
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
// In the app the fonts load without holding up the page: on a filtered connection they may never arrive.
const fonts = "https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,400..700&family=Frank+Ruhl+Libre:wght@500&family=David+Libre:wght@700&display=swap";
const head = appDir
  ? `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="sdm-app-build" content="${buildId}">
<title>Shiur Daled Mivtzoim</title>
<link rel="stylesheet" href="${fonts}" media="print" onload="this.media='all'">
<style>${css.css}</style></head><body>
<div id="root"></div>
<script>${js}</script></body></html>
`
  : `<title>Shiur Daled Mivtzoim</title>
<meta name="description" content="Track tefillin, Shabbos candles and every other mivtza, on your own and with your group.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css.css}</style>
<div id="root"></div>
<script>${js}</script>
`;

const outDir = appDir ?? path.join(root, "dist");
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, appDir ? "app.html" : "shiur-daled-mivtzoim.html");
await writeFile(out, head);
// The app compares this with the copy it has, and downloads app.html when they differ.
if (appDir) await writeFile(path.join(outDir, "app.json"), JSON.stringify({ build: buildId, bytes: Buffer.byteLength(head) }));
console.log(`Wrote ${path.relative(root, out)} (${(head.length / 1024).toFixed(0)} KB)`);
