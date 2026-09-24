# Shiur Daled Mivtzoim

A website for tracking mivtzoim: tefillin, Shabbos candles and any other mivtza you add, alone or with your shiur.

- **Dashboard**: one-tap +1 Tefillin and +1 Shabbos Candles, this week's totals, an 8-week chart and your groups.
- **Log Mivtzoim**: log any amount for any category and date. You can count it toward a group, a route or a stop.
- **Groups**: create a group and share its 6-letter code. Members see a weekly and all-time leaderboard, plus the group's routes.
- **Routes**: an ordered list of stops (stores, offices, homes) that you check off as you go. A route can be personal or shared with a group.
- **History**: every entry grouped by week. You can filter it and delete entries.
- **Profile**: your name, plus your own categories (Mezuzah, Tzedakah, Kashrus and the rest of the ten mivtzoim are one tap away).

## Where data is stored

The screens talk to one small interface (`lib/backend`). Which storage it uses depends on where the site runs:

| Where it runs | Storage | Sign-in |
| --- | --- | --- |
| Hosted with Supabase keys set | Supabase Postgres with row level security | Username and password |
| Published as a Claude artifact | The artifact's shared database | The viewer's Claude account |
| Anywhere else (no keys) | This browser only (`localStorage`) | Username and password (accounts live on that device) |

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase keys the site runs in single-device mode, which is useful for trying it out.

## Launch with Supabase and Vercel

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/001_initial.sql`, `002_app.sql` and `003_usernames.sql`, in that order.
   Then under **Authentication → Sign In / Providers → Email**, turn off **Confirm email**. People sign in with a username, so there is no inbox to confirm.
3. Import this repository at [vercel.com/new](https://vercel.com/new) and add these environment variables from Supabase **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## Single-file build

```bash
npm run build:single   # writes dist/shiur-daled-mivtzoim.html
```

This bundles the whole app, styles included, into one HTML file. That is the version published as a Claude artifact. Opened directly from disk it uses browser storage.

## Project layout

```
app/                 Next.js pages (thin wrappers around the screens) and global styles
components/views/    The screens: dashboard, log, groups, routes, history, profile, login
components/          App shell, navigation and UI pieces
lib/backend/         Supabase, Claude artifact and browser-storage backends
lib/data.tsx         Loads data and exposes the app's actions
spa/                 Entry point for the single-file build
supabase/migrations/ Database schema and security policies
```
