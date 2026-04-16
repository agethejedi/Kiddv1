# Vercel Setup Guide

## Step 1 — Import your GitHub repo into Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Find and select your `demoagent` repo
4. Vercel will detect it's a monorepo

## Step 2 — Configure the project settings

When prompted, set these values:

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | `cd ../.. && npx turbo run build --filter=@demoagent/web` |
| **Output Directory** | `.next` |
| **Install Command** | `cd ../.. && npm install` |

## Step 3 — Add environment variables

In the Vercel dashboard under **Settings → Environment Variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL        → your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  → your Supabase anon key
NEXT_PUBLIC_API_URL             → your Railway API URL (add after Railway setup)
NEXT_PUBLIC_APP_URL             → your Vercel deployment URL
```

## Step 4 — Get your Vercel token for CI/CD

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a new token named `github-actions`
3. In your GitHub repo go to **Settings → Secrets → Actions**
4. Add secret: `VERCEL_TOKEN` = the token you just created

## Step 5 — Deploy

Either push to `main` and let GitHub Actions deploy automatically,
or click **"Deploy"** in the Vercel dashboard for your first manual deploy.

## Domains

- Production: Vercel will give you `your-project.vercel.app` by default
- Custom domain: Add in **Settings → Domains**
- Staging: Push to `dev` branch — Vercel auto-creates a preview URL

## Environment parity

Vercel automatically creates separate environments:
- **Production** — `main` branch
- **Preview** — any other branch (including `dev`)
- **Development** — local `vercel dev`

Set different API URLs per environment if you want staging to point
at a staging Railway instance rather than production.
