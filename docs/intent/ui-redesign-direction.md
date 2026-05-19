# UI Redesign — Design Direction (v1)

_Companion to `ui-redesign.md`. The intent is locked; this doc specifies the system. Approve before any implementation._

## 1. Anchor references

| App | What we borrow | What we don't |
|---|---|---|
| **Linear** | Chrome density, restrained typography, near-neutral dark backgrounds, tiny radii on interactive elements, hover-state discipline. | Their purple accent — we go green. |
| **Watershed** | Climate/energy register: confident, slightly serious, green accent on cool-neutral surfaces, marketing-grade landing chrome. | Their data-heavy comparison-table pages — we are lighter on data. |
| **Vercel Dashboard** | Marketing-meets-product polish, dark-mode clarity, mono for numerics, monochrome iconography. | Their charcoal warmth — we stay cooler-neutral. |

## 2. Color system

The current palette reads "blue" because the background, card, border, *and* accent are all in the blue/teal family. Fix: shift surfaces to **near-neutral** (zinc, not navy) and replace the teal accent with a **single restrained green**. Domain colors (fuel types, status) move to a tokenized system, not hex-in-JSX.

### 2.1 Surface tokens (replaces `globals.css:8-31`)

All HSL. Cool-neutral, almost zero blue saturation. Compared to current, hue rotates ~213 → ~220 with saturation dropped from 33% to 6–8% so the cobalt cast disappears.

| Token | New value | New hex | Old hex | Role |
|---|---|---|---|---|
| `--background` | `220 8% 6%` | `#0e0f10` | `#080b0f` | App background |
| `--card` | `220 7% 9%` | `#15171a` | `#10161f` | Cards, popovers |
| `--muted` | `220 6% 13%` | `#1e2024` | _new_ | Subtle fills, table row hover |
| `--border` | `220 6% 18%` | `#2a2c31` | `#243140` | 1px borders |
| `--input` | `220 6% 18%` | `#2a2c31` | _same as border_ | Form fields |
| `--ring` | `152 55% 45%` | `#34a06a` | _teal_ | Focus rings (uses accent) |
| `--foreground` | `220 10% 95%` | `#f0f1f2` | _white_ | Primary text |
| `--muted-foreground` | `220 6% 60%` | `#92959c` | `#8ea0b5` | Secondary text |

### 2.2 Accent (the single green)

One green, three variants. Tuned to read confident-but-not-loud on the new neutral surfaces. Not Tailwind emerald (too SaaS-default), not lime (too electric) — a slightly desaturated, slightly cool green in the spirit of climate/grid software.

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--primary` | `152 55% 50%` | `#3ab87a` | Primary buttons, links, active nav, key data accents |
| `--primary-hover` | `152 55% 56%` | `#52c388` | Hover/focus state |
| `--primary-foreground` | `220 10% 8%` | `#121315` | Text on primary fills |
| `--accent-subtle` | `152 40% 18% / 0.4` | _alpha fill_ | Selected states, soft highlights, map live-marker glow |

**Rule:** the accent is reserved for primary actions and the single "this is alive / this matters" cue per screen. Everything else uses neutrals.

### 2.3 Domain colors (new — fuel types)

Move out of `dashboard.tsx:55-60` into a `tokens/fuel.ts` (or extended Tailwind config). Keeps energy-industry conventions but desaturates and harmonizes them against the neutral background.

| Fuel | Hex | Notes |
|---|---|---|
| Solar | `#f5b942` | Warm amber, slightly muted from current |
| Wind | `#5b9bd5` | Single cool blue — *this is the only blue in the app* |
| Storage | `#a78bfa` | Violet (current `#c084fc` desaturated) |
| Gas | `#e07b6d` | Coral-red |
| Hydro | `#4cb8c4` | Muted teal-cyan |
| Other / unknown | `#8b8e95` | Neutral gray |

### 2.4 Status colors (new — tokens, not Tailwind classes)

Replaces ad-hoc `bg-emerald-500/15` etc. in `health/page.tsx:12-16`. Note: success ≠ accent. The accent is the brand; success is a status. They are visually distinct so users don't confuse "primary action" with "operation succeeded."

| Status | Fill (alpha 15%) | Text | Hex (text) |
|---|---|---|---|
| Success | `#22c55e / 0.15` | green-300 | `#86efac` |
| Warning | `#f59e0b / 0.15` | amber-300 | `#fcd34d` |
| Error | `#ef4444 / 0.15` | red-300 | `#fca5a5` |
| Info | `#64748b / 0.15` | slate-300 | `#cbd5e1` |

## 3. Typography

Keep **Geist Sans** and **Geist Mono** — they're already correct for this register. The fix is hierarchy, not the typeface.

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Display (hero) | Geist Sans | 600 | 56–72px | -0.02em |
| H1 (page title) | Geist Sans | 600 | 28px | -0.015em |
| H2 (section) | Geist Sans | 600 | 20px | -0.01em |
| Body | Geist Sans | 400 | 14px | 0 |
| Body-sm / table | Geist Sans | 400 | 13px | 0 |
| Caption / label | Geist Sans | 500 | 12px | 0.01em, uppercase optional |
| Numeric / data | **Geist Mono** | 500 | 13–14px | tabular-nums |

**Rule:** all numbers in tables, badges, KPIs, and the map popups use Geist Mono with `font-variant-numeric: tabular-nums`. Numbers should align.

## 4. Spacing, radius, elevation

| Token | Value | Use |
|---|---|---|
| Radius — sm | `4px` | Buttons, inputs, badges |
| Radius — md | `6px` | Cards, popovers, dropdowns |
| Radius — lg | `10px` | Modals, large panels |
| Border | `1px solid var(--border)` | Default for all containers |
| Shadow — sm | _none on dark_ | Use border instead |
| Shadow — md | `0 4px 12px rgba(0,0,0,0.4)` | Popovers, dropdowns only |
| Shadow — lg | `0 12px 32px rgba(0,0,0,0.5)` | Modals |

Global radius drops from `0.5rem` (8px) → component-specific. Linear/Vercel skew tighter on interactive elements; this is the single biggest "polish" tell.

## 5. Iconography

| Surface | Library | Style |
|---|---|---|
| UI chrome (nav, buttons, menus) | **Lucide** (already in use) | 1.5px stroke, 16–18px |
| Domain icons (fuel types, queue phases) | **Custom monoline SVG** | Same 1.5px stroke; consolidate in `components/icons/fuel/`, `components/icons/phase/` |
| Status indicators | Lucide (`check-circle`, `alert-triangle`, etc.) | Match status color tokens |

**Rule:** no emoji. No mixed icon weights. One stroke width across the whole app.

## 6. Motion

Minimal, purposeful. The Linear/Vercel register has very little animation — what exists is fast (150–200ms) and only on state transitions.

- Hover: 100ms ease-out, color only.
- Open/close (dropdown, popover): 150ms ease-out.
- Page transitions: none (App Router default).
- Map markers: keep the pulse on "live" markers (it's a feature) but desaturate to `--accent-subtle`.

## 7. Theme architecture

Replace hard-coded dark with `next-themes` + CSS variable swapping. **Ship dark-only initially**, but wire the plumbing so the eventual light theme is a token swap, not a refactor.

## 8. Screen ranking (for the hero slice + rollout order)

Ranked by demo impact × current polish gap:

1. **`/dashboard`** ← **hero slice candidate.** Highest demo value, map already polished, biggest token-replacement payoff (fuel colors, accent, surfaces all change visibly).
2. `/` (homepage) — first impression for investors browsing the link cold.
3. `/search` — validates the table/filter/badge patterns that other pages reuse.
4. `/analysis` — needs a real charting library (Recharts recommended); biggest "indie tell" right now.
5. `/watchlists`, `/health` — list/status patterns; mostly inherit the system from earlier pages.
6. `/account`, `/login`, `/signup`, `/verify-request`, `/error` — auth/account chrome; lowest demo impact, highest reuse of patterns already established.

## 9. What's explicitly NOT in this direction

- Light theme (deferred per intent).
- Information-architecture rework beyond consistent page chrome.
- New features.
- Switching off Radix/Tailwind/Geist (the foundations are correct).

## 10. Locked decisions

1. **Hero slice:** `/dashboard`.
2. **Accent green:** `#3ab87a` (HSL `152 55% 50%`).
3. **Animation + charts:** `motion` (motion.dev) is the app-wide animation layer. Analysis charts are **custom-built** with Motion for entrances/transitions — no Recharts or other charting library.
4. **MagicUI:** scoped to marketing surfaces (`/`, login/signup hero) and KPI tickers (NumberTicker) inside the dashboard. Not used inside tables, filter chrome, or anything where density beats dazzle.
5. **Icons:** Lucide as the default. Other libraries (Tabler, Phosphor, etc.) only when Lucide is missing the concept. Stroke widths matched at 1.5px. Custom monoline set of 6 for fuel types (solar / wind / storage / gas / hydro / other).
6. **Fuel-type icons:** custom 6-icon monoline set in `components/icons/fuel/`.
