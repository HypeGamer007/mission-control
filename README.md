# Mission Control

Next.js dashboard for operating an OpenClaw Gateway + a Supabase-backed org (projects, agents, leads, enrichment, outreach).

## GitHub

Remote: **[github.com/HypeGamer007/mission-control](https://github.com/HypeGamer007/mission-control)** (default branch **`main`**).

Clone:

```bash
git clone https://github.com/HypeGamer007/mission-control.git
```

Optional: set your name/email for commits (`git config user.name "..."` and `git config user.email "..."` in this repo or globally).

`.env.local` is ignored and will not be pushed (see `.gitignore`).

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

