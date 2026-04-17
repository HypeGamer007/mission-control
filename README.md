# Mission Control

Next.js dashboard for operating an OpenClaw Gateway + a Supabase-backed org (projects, agents, leads, enrichment, outreach).

## GitHub

Create a new empty repository on GitHub named **`Mission-Control`** (hyphenated URL: `Mission-Control`), then from this folder:

```bash
git init
git add .
git commit -m "Initial commit: Mission Control"
git branch -M main
git remote add origin https://github.com/YOUR_USER/Mission-Control.git
git push -u origin main
```

If you use the **GitHub** integration in Cursor, you can use **Publish to GitHub** and choose the new repo name instead of the commands above. Ensure `.env.local` is never committed (it is listed in `.gitignore`).

## Prereqs

- Node.js 22+
- A package manager (`npm`, `pnpm`, or `yarn`)
- A Supabase project
- An OpenClaw Gateway endpoint + operator token/scopes

## Setup

1. Install deps:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.
   - For local gateways, the default is usually `ws://127.0.0.1:18789` (no path).
   - Some deployments use a path like `/ws` behind a proxy.

3. Run dev:

```bash
npm run dev
```

## Supabase

- Schema + RLS live in `supabase/migrations/`.
- Apply via Supabase CLI (recommended) or the SQL editor in Supabase Studio.

