# Deploying GPX Slicer

## Live setup

- **Live at:** https://gpxslicer.com (canonical). `www.gpxslicer.com` 308-redirects to it.
- **Host:** Vercel — project `gpx-slicer` under team `cochonmagiques-projects`,
  connected to https://github.com/CochonMagique/GPX-Slicer.
- **Deploy: push to `main`.** Every push auto-deploys to production:

  ```bash
  git add -A && git commit -m "your message" && git push
  ```

  Escape hatch: `vercel --prod` from this folder deploys the **local working
  tree** directly (bypassing GitHub) — use it only when you deliberately want
  to ship uncommitted state; it makes the live site diverge from the repo.
- **DNS:** stays at GoDaddy (nameservers unchanged). Two records point to Vercel:
  `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`.
- **SSL:** auto-issued by Vercel (Let's Encrypt) for both apex and `www`.
- The `www → non-www` redirect lives in [vercel.json](vercel.json) (`redirects`). If you
  ever change the domain, update the hostnames there too.

## What this app is

A **100% client-side React app** (Vite SPA). GPX parsing, the Leaflet map
(free OpenStreetMap / CyclOSM tiles), the elevation chart, and GPX export all run
in the browser. There is **no backend, no database, and no secrets** to configure.
All assets (fonts, icons, Leaflet markers) are self-hosted; the only external
requests are the map tiles.

## Local commands

```bash
npm install      # once
npm run dev      # local dev server at http://localhost:5173
npm run typecheck
npm test         # vitest unit tests
npm run build    # production build -> dist/
npm run preview  # serve the built dist/ locally
```

## Domain / DNS reference (already configured)

In the Vercel project, `gpxslicer.com` and `www.gpxslicer.com` are added under
**Settings → Domains**. GoDaddy hosts the DNS (nameservers unchanged):

| Type  | Host / Name | Value                    |
|-------|-------------|--------------------------|
| A     | `@`         | `76.76.21.21`            |
| CNAME | `www`       | `cname.vercel-dns.com`   |

If the domain ever changes: add the new domain in Vercel, set these records at
the registrar, and update the redirect hostnames in `vercel.json`.

## Notes

- The original product spec ([docs/original-spec.md](docs/original-spec.md))
  mentioned Komoot import/sync — not implemented (no network/API calls).
  Upload → slice → export GPX is the working feature set.
- If you ever add a real backend (accounts, saved routes, Komoot OAuth),
  Vercel Functions or a small server become relevant then — not now.
