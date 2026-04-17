# Mission Control

Next.js dashboard for operating an OpenClaw Gateway + a Supabase-backed org (projects, agents, leads, enrichment, outreach).

## GitHub

This repo is already initialized with `git` on branch **`main`**. To connect it to a new GitHub repository:

1. On [github.com/new](https://github.com/new), create a repository named **`Mission-Control`** (GitHub will show the slug as `Mission-Control`). Do **not** add a README, `.gitignore`, or license (avoids merge conflicts).
2. From this project folder, add the remote and push (replace `YOUR_USER` with your GitHub username or org):

```bash
git remote add origin https://github.com/YOUR_USER/Mission-Control.git
git push -u origin main
```

If you use Cursor’s **Publish to GitHub** flow, pick the empty **`Mission-Control`** repo you created, then push.

Optional: set your name/email for commits (`git config user.name "..."` and `git config user.email "..."` in this repo or globally), then `git commit --amend --reset-author` on the last commit if needed.

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

