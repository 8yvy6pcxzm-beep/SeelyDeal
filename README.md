# Tender

**AI-assisted sales proposals & quotes.** Build beautiful, interactive proposals,
send them, track every view, and close with one-click e-signature — from draft to
signature, all in one polished panel.

A production-grade **Next.js 16** starter, inspired by [proposify.com](https://www.proposify.com)
and [qwilr.com](https://qwilr.com). Rebrand it in five minutes.

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000  (runs in demo mode, no keys needed)
```

With no keys in `.env.local`, the app boots in **demo mode** from `lib/demo/data.ts` —
realistic proposals, clients, view timelines and e-sign states — so you can click
around immediately.

## Make it yours

Open this folder in **Claude Code** and say:

> **"set up this project"**  (or run **`/setup`**)

Claude interviews you for your **brand**, **logo**, **colors**, and the **API keys
this app needs**, then writes your `app.config.ts` and `.env.local` and boots it.
Prefer to do it by hand? Open [`START-HERE.md`](./START-HERE.md) or follow
[`SETUP.md`](./SETUP.md) — every step names the exact file to change.

## What's inside

```
app.config.ts            ← single source of truth (brand, copy, nav, integrations)
app/(marketing)/         ← landing page (hero + interactive sign demo + pricing…)
app/(app)/dashboard/     ← proposals cockpit (pipeline, table, builder, drawer)
app/(app)/proposals/     ← all proposals, filterable
app/(app)/templates/     ← template library + win-rate detail
app/(app)/settings/      ← brand + integration status
components/marketing/     ← sign-demo, product preview, company marks
components/app/           ← sidebar, topbar, charts (inline SVG), proposal bits
lib/demo/data.ts         ← sample proposals/clients/views that power demo mode
.env.example             ← the keys this kit can use (all optional)
SETUP.md                 ← the guided-setup script
```

## Integrations (all optional)

| Service | What it powers |
| --- | --- |
| **Supabase** | Database & auth for proposals, clients and view events |
| **Dropbox Sign** (HelloSign) | Legally binding e-signatures inside each proposal |
| **Stripe** | Charge accepted proposals & deposits the moment a client signs |
| **Anthropic** (Claude) | AI proposal drafting & section rewrites |

Missing keys keep that feature in demo mode — nothing breaks.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · lucide-react.
Fonts: **Instrument Sans** + **JetBrains Mono**. All charts and graphics are
inline SVG — no chart library, no photos. No database required to run.
