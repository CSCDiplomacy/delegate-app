# CSCD Delegate App — Color Scheme & Theme

**Active theme: "Credential / boarding-pass" edition** (see `newtheme.html` for the original mock). Warm *paper* + near-black *ink* with a **brass** seal accent and a **pink "signal"** highlight. Supports **light and dark mode** (toggle persisted in `localStorage` as `cscd_theme`). This supersedes the earlier cream/electric-yellow extraction.

Aesthetic: an editorial diplomatic "delegate credential" — a boarding-pass hero card, brass wax-seal motifs, hairline rules, soft shadows.

## Core palette (light)

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#FBF7EF` | App background |
| `--paper-soft` | `#F2ECDD` | Secondary surface / toggles |
| `--ink` | `#1B1812` | Primary text / dark seals |
| `--ink-soft` | `#4A4438` | Secondary text |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-2` | `#161310` | Boarding-pass hero / login card (dark on light) |
| `--brass` | `#C9A227` | **Primary accent** — seals, type badges, guide numbers, brass CTA |
| `--brass-deep` | `#9C7B17` | Brass gradient / star icons |
| `--signal` | `#FF2D6B` | **Live / alert accent** — "happening now", live strip, unread dots, primary CTA, active nav |
| `--signal-deep` | `#C7124C` | Signal text on light |
| `--hairline` | `rgba(27,24,18,0.14)` | Dividers / card borders |

## Dark mode
`[data-theme="dark"]` on `<html>` swaps the tokens: paper → `#15120E`, ink → `#F7F1E4`, surface → `#221E17`, brass → `#E8C158`, signal → `#FF4F84`, with deeper shadows. All components read from the CSS variables, so nothing else changes.

## Accent rules
- **Brass `--brass`** = the "official document" accent: the wax seals, rundown type badges, guided-check-in step numbers, secondary CTA.
- **Signal pink `--signal`** = anything *live or urgent*: the "happening now" strip, the live pill + now-marker on the rundown, unread notification dots, the primary action button, and the active nav state. Use it for emphasis, not as a fill everywhere.
- Most surfaces stay paper/ink; brass and signal are punctuation.

## Typography (unchanged)
- **Cinzel** (400–700) — display / headings / seals.
- **Cormorant Garamond** (italic 500) — boarding-pass subtitle / quotes.
- **Lato** (400–900) — body / UI.

```
fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@1,500&family=Lato:wght@400;500;600;700;800;900&display=swap
```

## Layout note
- **Mobile:** stacked screens, sticky topbar, bottom nav, slide-in drawers (Updates from the right, Menu from the left).
- **Desktop (≥960px):** a real 3-column website — **sidebar** (brand, vertical nav, theme toggle, sign-out) · **main canvas** (boarding-pass hero + screen content) · **right rail** (always-visible Updates feed, not a drawer).
