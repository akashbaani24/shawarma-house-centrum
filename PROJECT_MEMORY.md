# Project Memory — Shawarma House : Centrum Branch

## ⚠️ PERMANENT RULE (applies to ALL future updates)

**কখনো এন্ট্রি করা ডেটা ডিলিট বা মুছবেন না।** Whatever update is made — schema change, feature addition, bug fix, deployment — existing user data (entries, opening balances, denominations, bank accounts, users, types) MUST be preserved.

This means:
- ❌ NEVER run `prisma migrate reset` or `prisma db push --force-reset`
- ❌ NEVER drop/recreate tables that contain user data
- ❌ NEVER delete the Turso database
- ✅ Use `prisma db push` (additive only) or write additive migration scripts
- ✅ When schema changes are needed, write migration scripts that ALTER tables without data loss
- ✅ Test migrations against a copy first if risky
- ✅ Before any DB operation, verify it won't delete existing rows

## Admin Credentials (production Turso)
- Username: `admin`
- Password: `admin123`
- These are set directly in the Turso database (bcrypt hashed).

## Production
- URL: https://shawarma-house-centrum.vercel.app
- GitHub: https://github.com/akashbaani24/shawarma-house-centrum
- Database: Turso (libsql) — `libsql://sh-akash9090.aws-ap-south-1.turso.io`

## Environment Variables (Vercel + local .env)
| Variable | Value | Purpose |
|----------|-------|---------|
| `TURSO_DATABASE_URL` | `libsql://sh-akash9090.aws-ap-south-1.turso.io` | Actual Turso connection (used by PrismaLibSql adapter) |
| `TURSO_AUTH_TOKEN` | (Turso token) | Turso auth |
| `DATABASE_URL` | `file:./prisma-local.db` | Prisma sqlite engine validation (must be file: URL) |
| `NEXTAUTH_SECRET` | (base64 secret) | NextAuth JWT signing |
| `NEXTAUTH_URL` | `https://shawarma-house-centrum.vercel.app` | NextAuth callback URL |

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma 6.19 + @prisma/adapter-libsql 6.19 (v6 adapter API: `new PrismaLibSQL({url, authToken})`)
- NextAuth.js v4 (Credentials provider, JWT sessions)
- Turso (libsql) cloud database
- Vercel hosting (auto-deploy on push to main)

## Database Connection Architecture
- `src/lib/db.ts` uses a lazy Proxy to avoid build-time DB errors
- Prisma schema datasource = `file:./prisma-local.db` (for engine validation only)
- Actual runtime connection = Turso via PrismaLibSql adapter (reads `TURSO_DATABASE_URL`)
- NEVER change this architecture without testing data preservation first
