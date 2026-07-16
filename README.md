# GPX Slicer

Split long-distance GPX routes into multi-day segments, with an interactive map
and elevation profile. Live at **[gpxslicer.com](https://gpxslicer.com)**.

Upload a GPX track, choose how many days to split it into, drag the segment
boundaries on the map or elevation profile, and export each day as its own GPX
file. Everything runs **client-side in the browser** — no backend, no data leaves
your machine.

## Tech

- React + Vite (single-page app)
- [Leaflet](https://leafletjs.com/) + CyclOSM tiles for the map
- [Recharts](https://recharts.org/) for the elevation profile
- `gpxparser` for parsing, custom logic for slicing/export

All assets (logo, favicon, upload icon, Outfit font, Leaflet markers) are
self-hosted; the only external request is the map tile imagery.

## Local development

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # serve the built dist/ locally
```

## Deployment

Hosted on [Vercel](https://vercel.com/). This repo is connected to the Vercel
project, so **every push to `main` auto-deploys** to production. See
[DEPLOYMENT.md](DEPLOYMENT.md) for the full setup (domain, DNS, SSL).
