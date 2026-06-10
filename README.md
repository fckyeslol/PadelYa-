# PadelYa 🎾

**PadelYa matches padel players by level and books their courts — so you never miss a game.**

Padel is 2-on-2: you need exactly four people, and beginners rarely have three others at their level ready to play. PadelYa fills the match with players near your level and handles the court booking.

🔗 **Live:** [padelya.co](https://padelya.co)

## What it does
- Matches players by skill level and availability into a full 4-player game
- Books courts through an integration with the **easycancha** booking platform
- Charges a small fee per player on top of the booking

## Tech stack
- **Next.js** (App Router) + **TypeScript**
- **Supabase** (Postgres + auth) — see `supabase/`
- Integrations & business logic in `services/`; shared code in `lib/` and `hooks/`
- **Vitest** test suite in `tests/`

## Getting started
```bash
npm install
# add your Supabase + integration keys to .env.local
npm run dev
```
Then open http://localhost:3000.

## Project structure
```
app/         Next.js routes (App Router)
components/   UI components
services/     integrations (easycancha) & business logic
lib/ hooks/   shared utilities & React hooks
supabase/     schema & client
tests/        Vitest tests
docs/         product & design notes
```

## Status
Live with real users — **34 active users** and **500K COP** in revenue in the first 4 months, backed by an angel investment from TSSI.

---
Built by [Mateo Pirela](https://github.com/fckyeslol) · [mateo-five.vercel.app](https://mateo-five.vercel.app)
