# Shiur Daled Mivtzoim

A starter Next.js + TypeScript + Tailwind + Supabase project structure for the Shiur Daled Mivtzoim app.

## Quick start

1. Install Node.js LTS.
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and add your Supabase URL/key.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open http://localhost:3000.

This starter contains the core UI and data model scaffolding. Add the Supabase migration in `supabase/migrations/001_initial.sql`, then connect authentication and persistence.

## GitHub

```bash
git init
git add .
git commit -m "Initial Shiur Daled Mivtzoim app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shiur-daled-mivtzoim.git
git push -u origin main
```
