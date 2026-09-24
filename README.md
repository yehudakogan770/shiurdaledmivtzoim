# Shiur Daled Mivtzoim

A website for tracking mivtzoim: tefillin, Shabbos candles and any other mivtza you add, alone or with your shiur.

- **Dashboard**: one-tap +1 Tefillin and +1 Shabbos Candles, this week's totals and an 8-week chart.
- **Log Mivtzoim**: log any amount for any category and date. You can count it toward a route or a stop.
- **Routes**: an ordered list of stops (stores, offices, homes) that you check off as you go.
- **History**: every entry grouped by week. You can filter it and delete entries.
- **Profile**: your name, plus your own categories (Mezuzah, Tzedakah, Kashrus and the rest of the ten mivtzoim are one tap away).

## Where data is stored

The screens talk to one small interface (`lib/backend`). Which storage it uses depends on where the site runs:

| Where it runs | Storage | Sign-in |
| --- | --- | --- |
| Hosted with Supabase keys set | Supabase Postgres with row level security | Username and password; email confirms the account and resets passwords |
| Published as a Claude artifact | The artifact's shared database | The viewer's Claude account |
| Anywhere else (no keys) | This browser only (`localStorage`) | Username and password (accounts live on that device) |

## Admin

The account created with the email **sdmivtzoim87@gmail.com** is an admin (the list is in `lib/admin.ts`). Admins get an **Admin** page to:

- edit the site name, tagline, sign-up welcome text and a dashboard announcement
- add or hide mivtzoim categories offered to everyone
- see every person, their email, chavrusas, totals and entries, and make or remove admins
- see all activity, filtered by person or mivtza

With Supabase, create the admin account right after running the setup files, before sharing the link. Only an admin can change anyone's role; the database enforces this.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase keys the site runs in single-device mode, which is useful for trying it out.

## Launch with Supabase and Vercel

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the files in `supabase/migrations/` in order: `001_initial.sql` through `005_email_accounts.sql`.
3. In **Authentication**:
   - **Sign In / Providers → Email**: turn **Confirm email** on. New accounts get a confirmation link.
   - **URL Configuration**: set the Site URL to the website address and add it to Redirect URLs.
   - **Email Templates → Reset Password**: add `Your username is {{ .Data.username }}` so people who forgot their username get it with the reset link.
4. Import this repository at [vercel.com/new](https://vercel.com/new) and add these environment variables from Supabase **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy.

## Single-file build

```bash
npm run build:single   # writes dist/shiur-daled-mivtzoim.html
```

This bundles the whole app, styles included, into one HTML file. That is the version published as a Claude artifact. Opened directly from disk it uses browser storage.

## Project layout

```
app/                 Next.js pages (thin wrappers around the screens) and global styles
components/views/    The screens: dashboard, log, routes, history, profile, admin, login
components/          App shell, navigation and UI pieces
lib/backend/         Supabase, Claude artifact and browser-storage backends
lib/data.tsx         Loads data and exposes the app's actions
spa/                 Entry point for the single-file build
supabase/migrations/ Database schema and security policies
```
