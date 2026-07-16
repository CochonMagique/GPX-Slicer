# Deploying GPX Slicer

## Live setup (done)

- **Live at:** https://gpxslicer.com (canonical). `www.gpxslicer.com` 308-redirects to it.
- **Host:** Vercel — project `gpx-slicer` under team `cochonmagiques-projects`.
  The repo is already linked (`.vercel/`), so **redeploy with:** `vercel --prod` from this folder.
- **DNS:** stays at GoDaddy (nameservers unchanged). Two records point to Vercel:
  `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`.
- **SSL:** auto-issued by Vercel (Let's Encrypt) for both apex and `www`.
- The `www → non-www` redirect lives in [vercel.json](vercel.json) (`redirects`). If you
  ever change the domain, update the hostnames there too.

---

This is a **100% client-side React app** (Vite SPA). GPX parsing, the Leaflet map
(free OpenStreetMap / CyclOSM tiles), the elevation chart, and GPX export all run
in the browser. There is **no backend, no database, and no secrets** to configure.
(`helpers/db.tsx` + `helpers/schema.tsx` are unused Floot scaffolding.)

Because it's a static site, **Vercel is the recommended host** — not Fly.io.
Vercel serves static/SPA front-ends from a global CDN with automatic HTTPS and a
free tier that comfortably covers a personal tool. Fly.io is built for long-lived
servers/containers; using it here would mean writing a Dockerfile to run a static
file server for no benefit. (Cloudflare Pages and Netlify would work equally well.)

## Local commands

```bash
npm install      # once
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # serve the built dist/ locally
```

## Deploy to Vercel — CLI (fastest; the Vercel CLI is already installed)

```bash
cd "GPX Slicer Repo"
vercel login     # authenticates YOUR Vercel account (opens browser / emails a code)
vercel           # first run links or creates the project and deploys a preview URL
vercel --prod    # promotes the current build to production
```

Vercel auto-detects the framework as **Vite** (build `npm run build`, output `dist`);
`vercel.json` in this repo also pins those settings and adds the SPA fallback.

## Deploy to Vercel — Git (auto-deploy on every push, alternative)

1. `git init && git add . && git commit -m "Initial commit"`
2. Push to a new GitHub repo.
3. On https://vercel.com → **Add New… → Project** → import the repo.
4. Framework preset **Vite** is auto-detected → **Deploy**.

## Connect your GoDaddy domain

1. In the Vercel project: **Settings → Domains → Add** your domain (e.g. `example.com`).
   Add both `example.com` and `www.example.com`.
2. Vercel shows the exact DNS records to create. **Use the values Vercel shows** —
   they are the source of truth. They are normally:

   | Type  | Host / Name | Value                    |
   |-------|-------------|--------------------------|
   | A     | `@`         | `76.76.21.21`            |
   | CNAME | `www`       | `cname.vercel-dns.com`   |

3. In **GoDaddy → your domain → DNS → Manage DNS**:
   - Add/edit the **A** record: Host `@` → `76.76.21.21`.
   - Add/edit the **CNAME** record: Host `www` → `cname.vercel-dns.com`.
   - **Delete any conflicting records** GoDaddy added for `@` or `www`
     (e.g. a parked-page A record or a `www` CNAME to `@`).
   - Leave GoDaddy's nameservers as they are — you do **not** need to change them.
4. Back in Vercel, the domain verifies automatically once DNS propagates
   (usually minutes, up to ~48h). Vercel then issues the SSL certificate for free.

## Notes

- The original spec mentioned Komoot import/sync — that is **not implemented** in
  this code (there are no network/API calls). Upload → slice → export GPX works.
- The JS bundle is ~872 kB (≈258 kB gzipped) — fine for a personal tool; it can be
  code-split later (e.g. lazy-load the map) if you want to trim it.
- If you ever add a real backend (accounts, saved routes, Komoot OAuth), Fly.io or
  Vercel Functions become relevant then — not now.
