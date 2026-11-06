# CLAUDE.md — Shiur Daled Mivtzoim

**Read HANDOFF.md first for the full history, current status, and where everything lives.**

## What this project is
A website, live at **https://sdmivtzoim.com**, where bochurim on Shiur Daled log their weekly Mivtzoim: Tefillin, Shabbos Candles and the rest. People log by route, with Chavrusas. The site also has a shared photo wall, Excel export, and Owner/Admin tools. It is built with Next.js 16 (static export), React 19, Tailwind v4, TypeScript and Supabase (auth, Postgres with RLS, and the "photos" storage bucket). It is hosted on GitHub Pages.

## The person you work with
- They're not a programmer. Use plain, short language, give step-by-step instructions, and avoid jargon.
- They often can't open artifact/web previews. **Send PNG images** (SendUserFile) as previews.
- **Never ask for passwords or secret keys.** When something needs one, give them the steps to do it themselves.

## ALWAYS / NEVER rules
- **Pushing to `claude/zealous-brown-7i5ws4` (or `main`) deploys the LIVE site.** Before pushing a visible change, show sample images and wait for "go" / "go ahead" / "make it live".
- **Never merge to `main`** unless asked. `main` also deploys and is far behind the working branch.
- **Never change the site's colors.**
- **Everything is glass** (frosted, see-through cards over soft color glows), never solid. Corners are "softly squared", as already set.
- **Hebrew always stays Hebrew.** It is never translated or transliterated. Hebrew site text is capitalized as set.
- **The Owner account (sdmivtzoim87@gmail.com) is always in English.** Choosing a language is only for regular users (English, Hebrew, French, Spanish).
- Every user-visible string goes through `t()` / `tn()` from `lib/i18n`, with he/fr/es translations in `lib/i18n/strings/<area>.ts`. Owner-only screens can stay English.
- Database changes: add a new numbered file in `supabase/migrations/` (e.g. `016_...sql`), append it to `supabase/setup.sql`, and give the user the SQL to paste into the Supabase SQL Editor. Make it safe to run twice. The site must keep working (with a friendly message) if the update hasn't been run yet.
- Never commit keys, `.env` files, or personal data: sheet photos, names with mothers' names, or people photos. **The repo is PUBLIC.**
- No Pull Requests unless asked. No model names in commits or files.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
  (plus a `Claude-Session:` line for the current session, if given).

## Posters / signs (made with Playwright from HTML; see handoff-files/posters)
- Use the site's look: color-glow background, glass cards, the **Google Sans Flex** font and the logo.
- **בס״ד** goes top right as plain text, with nothing behind it.
- Light versions get a soft corner light pushed into the corner. Dark versions get **no** corner light.
- The donation line goes at the bottom: Pushka / Cash App / Zelle.
- Grammar:
  - In English headings, capitalize every word, but keep small words ("in", "on", "of", "to", "and") lowercase.
  - Use commas where they fit, not periods.
  - Write "Cash App" and "vs.".
- Phone-only signs are **1080×2340**. Print sheets are 8.5×11.

## Coding style
- Match the surrounding code: small function components, Tailwind classes, `lucide-react` icons, UI pieces from `components/ui`.
- Comments explain *why* in plain English and stay short.
- Screens live in `components/views/*` (pages in `app/*` are thin wrappers). Data and actions are in `lib/data.tsx`. Storage goes through `lib/backend/*` (supabase / local / claude backends behind one interface).
- Owner checks: `ADMIN_EMAILS` in `lib/admin.ts`, and `is_owner()` in SQL.

## Commands
```bash
npm install
npm run dev                                   # http://localhost:3000 (no keys = this-browser-only mode)
./node_modules/.bin/tsc --noEmit -p .         # typecheck (the "test" step; there is no unit-test suite)
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH= npx next build   # same build as the live site, output in out/
npm run build:single                          # one-file HTML version in dist/
```
To test in a browser, serve `out/` (e.g. `npx serve out`) and use Playwright. Chromium is at `/opt/pw-browsers` in cloud sessions.

**Deploy:** commit and `git push origin claude/zealous-brown-7i5ws4`. The GitHub Action `.github/workflows/deploy-pages.yml` builds and publishes to the `gh-pages` branch, and it goes live at sdmivtzoim.com in about 2 minutes. To check that a deploy is live, `curl` a JS chunk from the site and look for a new string.
