# MPLADS AI — Frontend

Next.js 16 (App Router) frontend for the MPLADS AI risk and monitoring
intelligence platform. See the [project README](../README.md) for the overall
architecture and backend setup — the backend must be running for this app to
show data.

## Setup

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE if the backend isn't on localhost:8000
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — production build
- `npm run lint` — type-check and lint

## Structure

- `app/` — routes (App Router); `app/(app)/` holds the authenticated screens
  (Overview, Risk Intelligence, Works, Fund & Payments, Analytics, Inspection
  Queue, Network, Reports)
- `components/` — shared UI components
- `lib/` — API client, types, role/scope context, formatting utilities
- `public/geo/` — simplified India state boundary data for the risk map

## Stack

Next.js 16, React, TypeScript, Tailwind CSS, Chart.js, GSAP, d3-geo.
