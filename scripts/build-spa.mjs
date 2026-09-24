// Builds the whole app into one self-contained HTML file (dist/shiur-daled-mivtzoim.html)
// that can be published as a Claude artifact or opened straight from disk.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
  },
  plugins: [
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
const html = `<title>Shiur Daled Mivtzoim</title>
<meta name="description" content="Track tefillin, Shabbos candles and every other mivtza, on your own and with your group.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,400..700&display=swap">
<style>${css.css}</style>
<div id="root"></div>
<script>${js}</script>
`;

await mkdir(path.join(root, "dist"), { recursive: true });
const out = path.join(root, "dist/shiur-daled-mivtzoim.html");
await writeFile(out, html);
console.log(`Wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
