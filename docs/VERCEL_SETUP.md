# Vercel Setup Guide

## 1. Connect repo to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel will auto-detect the framework as **Next.js**
4. Set **Root Directory** to `apps/web`
5. Leave all other build settings as default — they're already in `vercel.json`

## 2. Add environment variables

In Vercel → Project → Settings → Environment Variables, add these:

| Variable | Value | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Railway URL (after API deploy) |
| `NEXT_PUBLIC_APP_URL` | `https://app.yourdomain.com` | Your Vercel domain |

> **Note**: During initial development, set `NEXT_PUBLIC_API_URL` to your Railway dev URL.
> You can update it later when you have a custom domain.

## 3. Deploy

Push to `main` → Vercel auto-deploys. Every PR gets a preview URL automatically.

## 4. Custom domain (optional)

1. Vercel → Project → Settings → Domains
2. Add `app.yourdomain.com`
3. Update DNS at your registrar with the CNAME Vercel gives you
4. Update `NEXT_PUBLIC_APP_URL` to match

## 5. Preview environments

Vercel creates a unique URL for every branch/PR automatically.  
Use these for testing before merging to `main`.

---

## Troubleshooting

**Build fails with "Cannot find module '@demoagent/shared'"**  
→ Make sure Root Directory is set to `apps/web` in Vercel settings, not the repo root.

**API calls return 404**  
→ Check `NEXT_PUBLIC_API_URL` is set correctly and your Railway API is running.

**Supabase connection errors**  
→ Verify both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel env vars.
