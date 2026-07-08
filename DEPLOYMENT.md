# Deployment Guide — Shawarma House : Centrum Branch

This project is configured for **auto-deploy** to Vercel via GitHub.

## Architecture
- **Database:** Turso (libsql) cloud database
- **Framework:** Next.js 16 (App Router) + TypeScript
- **ORM:** Prisma 6 with `@prisma/adapter-libsql`
- **Auth:** NextAuth.js (Credentials provider, JWT sessions)
- **Hosting:** Vercel (auto-deploys on push to `main`)

## Required Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `libsql://sh-akash9090.aws-ap-south-1.turso.io` |
| `TURSO_AUTH_TOKEN` | (your Turso auth token) |
| `NEXTAUTH_SECRET` | (a random base64 string — generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://your-vercel-domain.vercel.app` (update after first deploy) |

## Initial Setup (already done)

1. ✅ Installed `@libsql/client` + `@prisma/adapter-libsql`
2. ✅ Updated `src/lib/db.ts` to use the Turso adapter
3. ✅ Created all tables on Turso via `scripts/migrate-turso.js`
4. ✅ Seeded admin user + 21 default entry types via `scripts/seed-turso.js`

## Auto-Deploy Setup (one-time)

### Step 1: Push to GitHub
The code is pushed to a GitHub repository. Every push to `main` triggers:
- GitHub Actions: lint + build check (`.github/workflows/build.yml`)
- Vercel: automatic deployment

### Step 2: Connect Vercel to GitHub
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import the GitHub repository
4. Vercel auto-detects Next.js (uses `vercel.json`)
5. Add the 4 environment variables (see table above)
6. Click **Deploy**

### Step 3: Update NEXTAUTH_URL
After the first deploy, Vercel gives you a domain like `shawarma-house.vercel.app`.
Update the `NEXTAUTH_URL` env var in Vercel to `https://shawarma-house.vercel.app` and redeploy.

## Login

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@eventrum.com | admin123 |

**⚠️ Change the admin password after first login.**

## Database Management

### Run migrations (after schema changes)
```bash
# Local (reads .env)
set -a && source .env && set +a && node scripts/migrate-turso.js
```

### Re-seed (fresh DB only)
```bash
set -a && source .env && set +a && node scripts/seed-turso.js
```

### View data in Turso
Use the Turso CLI or [Turso dashboard](https://turso.tech/app) to inspect tables.

## Local Development
```bash
bun install
bun run db:generate
bun run dev   # http://localhost:3000
```
