# HANDOFF — Shiur Daled Mivtzoim

Written 2026-10-19 because the owner is moving to a new Claude account. A new session should read this file and `CLAUDE.md`, and then it can continue from here.

---

## 1. Goal
The goal is a simple, beautiful website for **Shiur Daled** to track Mivtzoim every week. Bochurim log Tefillin, Shabbos Candles and the other mivtzoim, per route and with their Chavrusas. They also share photos from Mivtzoim. The **Owner** (sdmivtzoim87@gmail.com) runs the site: they edit content, see everyone's numbers, export Excel, create accounts for people on the spot, and get print-quality copies of photos in Google Drive. The site is live at **https://sdmivtzoim.com** and people use it every week.

## 2. What's built and how it's structured
- **Stack:**
  - Next.js 16 (static export, `STATIC_EXPORT=1`), React 19, Tailwind v4, TypeScript.
  - Supabase for accounts (username + password; behind the scenes each username maps to an email), Postgres with row-level security, and the `photos` storage bucket.
  - Hosted on GitHub Pages under the custom domain sdmivtzoim.com.
- **Layout:**
  - `app/*`: thin page wrappers. `components/views/*`: the screens (dashboard/Home, log, routes, history, profile, admin, login, photos, account-desk).
  - `components/*`: the app shell (glass top bar and side menu), UI kit, and cards (photo-drive-card, etc.).
  - `lib/data.tsx`: loads data and exposes every action. `lib/backend/*`: three storage backends behind one interface:
    - `supabase` (live);
    - `local` (this browser only, used when there are no keys);
    - `claude` (when published as a Claude artifact).
  - `lib/i18n/*`: `t()`/`tn()` and the translations (he/fr/es) per area.
  - `lib/export.ts`: Excel export with ExcelJS. Sheets: Summary, one per week, By route, All entries.
  - `lib/drive.ts` + `lib/photos.ts`: print copies to Google Drive (3000px JPEG).
  - `lib/account-desk.ts` + `components/views/account-desk.tsx`: the Owner's "Create accounts" desk.
  - `supabase/migrations/001…015`: the database. `supabase/setup.sql` is all of them in order. `supabase/setup-parts/` is the same split into pieces. `supabase/email-templates/` holds the branded emails.
  - `scripts/build-spa.mjs` + `spa/`: a single-file HTML build (`dist/`).
- **Features (all live):**
  - **Home:** one-tap counters with +/− tap counts and an "Everyone this week" strip. Also a week picker (parsha weeks start Friday 5am), the parsha name in Hebrew, this Friday's shkiah for your location, a photo slideshow (2 s), and an 8-week chart.
  - **Routes:** stops with address suggestions (Google when a key is set, otherwise OpenStreetMap), and business-card scanning (tesseract.js).
  - **History:** grouped by week, filters, and editable entries.
  - **Profile:** route name, Chavrusas (English name + Hebrew name with mother's name), username, email and password.
  - **Photos:** a shared wall arranged per week, upload with preview, and "My photos".
  - **Languages:** English, Hebrew, French and Spanish. The Owner is always English.
  - **Installable as a phone app (PWA).** The site refreshes itself when a new version is live.
  - **Owner features:**
    - edit site text right on Home;
    - hide mivtzoim from a chosen week (totals are kept);
    - set the order of mivtzoim and their icons;
    - see and edit everyone's routes and history;
    - Admin page with people, admins, password resets and Excel export;
    - **Create accounts** desk: hand the phone to someone to make an account, or "Find my account" to log for them. Leaving the desk needs the Owner password;
    - **Print copies in Google Drive** card.
- **Look:**
  - Glass (frosted cards over soft glows of the site colors) and softly squared corners.
  - Google Sans Flex for English. David Libre bold for the Hebrew week name.

## 3. Decisions and why
- **GitHub Pages + static export:** it's free and simple, and Supabase does all the server work through RLS.
- **The Supabase anon key is in the workflow file:** it's the *publishable* key, public by design, and RLS protects the data.
- **Username sign-in:** bochurim remember usernames better than emails. `cleanUsername` strips invisible characters, because phones were adding them and normal usernames were being rejected.
- **The Owner creates accounts directly** (migration 013, `owner_create_account`, email pre-confirmed). Confirmation emails weren't arriving for many people.
- **Print copies go to the Owner's own Google Drive** via a Google Apps Script web app. This avoids paid storage, and the site keeps only small, fast photos.
- **The Owner is always English.** The owner asked for this. Language choice is for users.
- **Glass everywhere, colors never change.** The owner asked for this.
- **Pushing the working branch deploys live.** That's why every visible change is shown as images first and waits for "go".

## 4. Run / test / deploy
```bash
npm install
npm run dev                                              # local, http://localhost:3000
./node_modules/.bin/tsc --noEmit -p .                    # typecheck (no unit tests exist)
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH= npx next build    # same build as live → out/
```
- **Test:** serve `out/` and click through with Playwright, taking screenshots on phone (390 wide) and computer, in light and dark.
- **Deploy:** `git push origin claude/zealous-brown-7i5ws4`. The Action "Deploy website" builds and pushes `out/` to `gh-pages`, and it's live in about 2 minutes.
- **Database changes:** the owner pastes the SQL into Supabase → SQL Editor → Run.

---

## WHERE EVERYTHING LIVES

### Repository
| Item | Value |
| --- | --- |
| GitHub repo | **yehudakogan770/shiurdaledmivtzoim**, **PUBLIC**. Earlier name: `yehudakogan770/ShiurDaledMivtoim`; GitHub redirects the old URL. |
| Owner (GitHub user) | `yehudakogan770` |
| Working branch (LIVE) | **`claude/zealous-brown-7i5ws4`**. All current work is here, and pushing deploys the live site. |
| `main` | **127 commits behind** the working branch, and it ALSO triggers a deploy. Do not push or merge to it, or the live site would roll back to old code. |
| `gh-pages` | Built site output, written by the Action. Don't edit by hand. |
| Deploy workflow | `.github/workflows/deploy-pages.yml` |

### Hosting, URLs and domain
| Item | Value |
| --- | --- |
| Live site | https://sdmivtzoim.com (GitHub Pages; the CNAME is set by the workflow) |
| Owner/Admin pages | https://sdmivtzoim.com/admin, https://sdmivtzoim.com/accounts (Create accounts desk). Both need the Owner to be signed in. |
| Domain registrar / DNS | **UNCONFIRMED.** The owner bought sdmivtzoim.com somewhere and pointed it at GitHub Pages. |
| GitHub Pages settings | Repo → Settings → Pages (source: `gh-pages` branch, custom domain sdmivtzoim.com). The exact settings are UNCONFIRMED. |
| Google Search Console | Set up via sitemap.xml/robots.txt. Whether it's verified is UNCONFIRMED. |

### Database and storage
| Item | Value |
| --- | --- |
| Supabase project | Ref `fkyzknggspsaeqguendg`, URL https://fkyzknggspsaeqguendg.supabase.co. Dashboard: https://supabase.com/dashboard/project/fkyzknggspsaeqguendg. The Supabase login account is UNCONFIRMED (probably sdmivtzoim87@gmail.com). |
| Tables / functions | See `supabase/migrations/001…015`. Key pieces: profiles, activity, categories, routes, locations, photos, photo_drive, site settings; and the functions is_owner() and owner_create_account(). |
| Storage | Supabase Storage bucket **`photos`** (the website's small photos) |
| Print photos | The Owner's Google Drive, folder **"Mivtzoim Photos"**, one folder per week. It only works after the Drive setup is finished (see Left to do). |

### Outside services and accounts
| Service | Used for | Account |
| --- | --- | --- |
| GitHub | Code, Actions, Pages | yehudakogan770 |
| Supabase | Auth, database, photo storage | UNCONFIRMED (likely sdmivtzoim87@gmail.com) |
| Google account sdmivtzoim87@gmail.com | The site Owner login email; Google Drive + Apps Script for print copies | the owner |
| Google Apps Script | The web app that receives print copies (script in `handoff-files/google-drive/`) | sdmivtzoim87@gmail.com. Deployment is not confirmed working yet. |
| Google Maps Places API (optional) | Address suggestions | Only if the `NEXT_PUBLIC_GOOGLE_MAPS_KEY` repo variable is set. UNCONFIRMED whether it is; OpenStreetMap is used otherwise. |
| Domain registrar | sdmivtzoim.com | UNCONFIRMED |
| Cash App / Zelle / Pushka | Donation links in the footer and on posters | the owner's. The details are in the site settings/footer code. |
| Canva | The owner imported poster PDFs to edit them | the owner's Canva account (UNCONFIRMED which) |

### Environment variables (names and sources only, no values here)
| Name | Where it's set |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub repo **Variables** (`vars.`), with a fallback written in the workflow file |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | GitHub repo **Variables**, with a fallback (the publishable key) in the workflow file |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | GitHub repo **Variables** (optional; UNCONFIRMED if set) |
| `STATIC_EXPORT`, `NEXT_PUBLIC_BASE_PATH` | Set in the workflow file (`"1"` and `""`) |
| `NEXT_PUBLIC_BUILD_ID` / `GITHUB_SHA` | Set automatically during the Actions build (version check) |
| `GITHUB_TOKEN` | Automatic GitHub Actions secret (publishes gh-pages) |
| Local dev | `.env.local` (git-ignored) with the two Supabase names above, if you want live data locally |

### Outside files (not in the repo)
- Old chat scratchpad, which will be lost with the old account: `/tmp/claude-0/-home-user-ShiurDaledMivtoim/4028b542-0984-514d-bb38-dc99f7c41423/scratchpad/`. Everything safe from it was copied to `handoff-files/`.
- Old chat uploads (22 files): `/root/.claude/uploads/4028b542-0984-514d-bb38-dc99f7c41423/`. These are **not copied** (see section 8).
- The Mivtzoim paper sheets and the filled-out Excel are on the owner's phone/computer.

---

## 5. Done / left / skipped

### Done (all pushed and live on `claude/zealous-brown-7i5ws4`)
- Everything in section 2.
- The last commits:
  - Create accounts desk + Find my account;
  - Google Drive print copies;
  - the Owner always in English;
  - the username invisible-character fix;
  - the week picker that fits "Parshas … 16" without cutting it off;
  - **(today)** the Drive script answers a browser check (`doGet`), and the site shows a clear message when Google refuses ("Failed to fetch").
- Posters (4 languages, light/dark), print cards, backgrounds, WhatsApp status reminders and phone signs (No more paper / Upload photos / Raffle). They're in `handoff-files/posters/`.

### Left to do (needs the owner: passwords, decisions or clicks in other services)
1. **Run database updates 014 and 015** in Supabase SQL Editor if they haven't been run yet (UNCONFIRMED: 013 was confirmed run). Use `handoff-files/database-sql/Database-updates-014-and-015.sql`, which is the same as `supabase/migrations/014…` and `015…`.
   - 014 lets the Owner log Mivtzoim for anyone (needed for "Find my account").
   - 015 saves the Drive link.
2. **Finish the Google Drive connection.** Signed in as sdmivtzoim87@gmail.com:
   - Go to script.google.com → New project and paste the script. Use the **Copy script** button on the Admin card, or `handoff-files/google-drive/Google-Drive-script-v2.txt`.
   - Deploy → New deployment → Web app. Set Execute as: **Me** and Who has access: **Anyone**, then authorize.
   - Open the Web app URL in a browser; it should say "Connected".
   - Paste the URL into Admin → Print copies → Connect.
   - Earlier attempts showed "Failed to fetch", which almost always means access wasn't "Anyone" or the wrong Google account was used.
3. **Confirmation emails:** the decision is the owner's. Recommended: Supabase → Authentication → Sign In / Providers → Email → turn **Confirm email OFF**, then run in SQL Editor:
   `update auth.users set email_confirmed_at = now() where email_confirmed_at is null;`
   After that, optionally change the sign-up wording "We send a confirmation link…". It's not changed yet, pending the owner's choice. The alternative is custom SMTP (a paid/extra service).
4. **Raffle details:** the prize and the exact Tuesday deadline time. The raffle sign says to fill out the website before Tuesday. Update the sign if the details change (`handoff-files/posters/generator-scripts/signs.mjs`).
5. Optional: set `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (needs a paid Google Cloud key) for Google address suggestions.

### Skipped on purpose
- Merging to `main`: it would redeploy the live site, and `main` is old. Left on the branch.
- Committing personal data (see section 8).

---

## 6. handoff-files (copied from the chat into the repo)
| Path | What it is |
| --- | --- |
| `handoff-files/posters/final-posters/*.png` | The final posters, light and dark: 01–04 main poster in English/Hebrew/Spanish/French; 05 "Just Got Easier", 06 "Counted", 07 "Easy", 08 "Route", 09 "Everywhere", 10 "Every Week" |
| `handoff-files/posters/pdfs/Shiur-Daled-Mivtzoim-Posters-8.5x11.pdf` | All posters, print size |
| `handoff-files/posters/pdfs/Shiur-Daled-Mivtzoim-English-Posters-8.5x11.pdf` | English posters only, print size |
| `handoff-files/posters/pdfs/Shiur-Daled-Mivtzoim-Backgrounds-8.5x11.pdf` | Blank glow backgrounds (light/dark) for making new signs |
| `handoff-files/posters/pdfs/Shiur-Daled-Mivtzoim-Print-Cards.pdf` | Small print cards |
| `handoff-files/posters/pdfs/Canva3-Posters-Light.pdf`, `Canva3-Posters-Dark.pdf` | Posters made for importing into Canva to edit |
| `handoff-files/posters/pdfs/Signs-8.5x11.pdf` | The phone signs on letter paper |
| `handoff-files/posters/phone-signs/*.png` | Phone signs, 1080×2340, light and dark: **No-more-paper**, **Upload-photos**, **Raffle** (fill out before Tuesday) |
| `handoff-files/posters/whatsapp-status/Reminder-light.png`, `Reminder-dark.png` | WhatsApp status: "Don't forget to fill out the website for this week and upload your images" |
| `handoff-files/posters/generator-scripts/` | The Playwright scripts that made everything: `gen*.mjs` posters, `signs.mjs` phone signs, `status.mjs` status, `pdf*.cjs`/`printpdf.cjs` PDFs, `shots.cjs` site screenshots used inside the posters, plus other helpers. **They point at the old scratchpad paths**, so change the paths before re-running. |
| `handoff-files/posters/fonts/` | Google Sans Flex (and others) woff2 + `fonts.css`, used by the poster scripts offline |
| `handoff-files/database-sql/Database-update-013.sql` | Owner creates accounts (already run) |
| `handoff-files/database-sql/Database-update-014.sql`, `-015.sql`, `Database-updates-014-and-015.sql` | Owner logs for anyone; Drive link setting. Run if not yet run. |
| `handoff-files/google-drive/Google-Drive-script-v2.txt` | **Current** Apps Script for print copies (with the `doGet` check). Same as in `lib/drive.ts`. |
| `handoff-files/google-drive/Google-Drive-script.txt` | First version (no `doGet`), kept for reference |
| `handoff-files/qr-join-card/` | QR "join" card image, its HTML and the QR SVG |
| `handoff-files/notes/email-setup.html` | Step-by-step guide made earlier for Supabase email templates/SMTP |
| `handoff-files/notes/i18n-brief.md` | The rules used when translating the site (useful when adding new text) |

## 7. Files over 100MB
None. The largest single file is about 7 MB; the whole folder is about 44 MB.

## 8. Files NOT saved to the repo (privacy: the repo is public)
These stay only in the old chat. **Download them before the old account closes** if you still need them.
- **Paper sign-up sheet photos** (names + mothers' names): the uploads folder and `scratchpad/crop/`, `scratchpad/week/sheet*.png`.
- **"Filled out – Parshas Bereshis (checked).xlsx"** and the unchecked version: names compared against the website (`scratchpad/list/`).
- **This week's 46 site photos** of people on Mivtzoim (`scratchpad/week/`) and test print copies (`scratchpad/drive/`). The originals are safe on the website (Supabase `photos` bucket).
- **Screenshots the owner sent** (account/admin screens with emails): the uploads folder.
- `anon.txt`: the publishable key. It's already in the workflow file, but it's not committed as a separate file.
- Uploaded `shiur-daled-mivtzoim-main.zip`: the original starter app, already imported into the repo history.
- Hundreds of scratch screenshots and test scripts from development (not needed; the site code is the source of truth).

---

## 9. Detailed summary of the whole conversation
**Sept 24 – setup.**
- Imported a Next.js starter and built the full site: dashboard, log, routes, history and profile.
- Redesigned it in the Google Pixel / Material You style, switched to username sign-in, and added the admin account and page.
- Deployed to GitHub Pages and connected Supabase.

**Sept 28.**
- Parsha weeks (Friday 5am, starting Ki Seitzei), shkiah, and address suggestions.
- Admin can edit shared mivtzoim and people, taps are instant, and the site became a phone app (PWA).

**Sept 29.**
- Moved to the custom domain sdmivtzoim.com and connected Supabase project fkyzknggspsaeqguendg.
- Added the setup.sql parts, the footer with Cash App/Zelle, the license, sitemap and the Everyone strip.
- Added +/− tap counters, account settings pop-ups, branded email templates, and the Excel export by week.

**Oct 2.**
- Owner powers: edit on Home, hide mivtzoim by week, and see/edit everyone's routes and history.
- Chavrusas' Hebrew names (name בן mother's name), required for all accounts.
- Excel organized by week and route, plus OpenStreetMap suggestions.

**Oct 5–6.**
- Photos: the shared wall, Home photo hero, smart arrangement, and the "Bring the week to life" pop-up.
- Business-card scanning, and four languages.
- Softly squared corners and tighter spacing.

**Oct 7–8.**
- The glass look everywhere, including the menu and top bar, and the iPhone bounce fill.
- Posters in many rounds: the site look, בס״ד, corner light only on light versions, the donation line and grammar fixes. Plus a Canva import (the temporary files were removed).
- The Create accounts desk and Find my account. The slideshow slowed to 2 s.

**Oct 12.**
- Google Drive print copies (Owner-only card, migration 015).
- The Owner is always English, and the Language card was removed from Owner Admin.

**Oct 14.**
- People couldn't create accounts with normal usernames because of invisible characters. Fixed with `cleanUsername` and clearer errors.
- Gave the SQL for 013 (run) and 014/015.
- Drive "Failed to fetch": gave setup steps and made the v2 script.
- Compared five paper-sheet photos with the website's export, and gave the lists of who filled out what.
- Rebuilt the photo flow explanation step by step, and made the WhatsApp status reminder.
- Confirmation emails weren't arriving: advised turning off Confirm email and confirming all users with SQL.

**Oct 18.**
- The week picker cut off "16". It now shrinks the text or wraps so the whole week shows (live).
- Made phone signs (No more paper, Upload photos, and Raffle "fill out before Tuesday") at full phone size, using this week's photos.

**Oct 19 (this handoff).**
- Saved all work and pushed the small Drive fix (`doGet` + clear error).
- Collected the files into `handoff-files/`, and wrote CLAUDE.md and this HANDOFF.md.

**Where to pick up:** see "Left to do" above. Most likely the owner will want help with the Drive connection, the Confirm-email change, or new signs/posters for the next week or the raffle.
