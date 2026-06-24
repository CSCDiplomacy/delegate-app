# CIPES Delegate App — Color Scheme & Theme

**Active theme: "Credential / boarding-pass" edition — CIPES YEF Frankfurt palette.** Deep navy + warm parchment-beige. Supports **light and dark mode** (toggle persisted in `localStorage` as `cipes_theme`).

Aesthetic: an editorial diplomatic "delegate credential" — a boarding-pass hero card, navy seals, hairline rules, soft shadows. Mirrors the YEF Frankfurt 2026 landing page branding.

## Core palette (light)

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#F9F9F9` | App background |
| `--paper-soft` | `#F4F7F9` | Secondary surface / toggles |
| `--ink` | `#111111` | Primary text |
| `--ink-soft` | `#333333` | Secondary text |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-2` | `#001224` | Boarding-pass hero / login card (dark navy) |
| `--brass` | `#D1C5A9` | **Secondary accent** — type badges, guide numbers, avatars (beige-dark) |
| `--brass-deep` | `#C4B593` | Brass gradient deep |
| `--signal` | `#001224` | **Primary action** — CTAs, active nav, live strip, unread dots |
| `--signal-deep` | `#002244` | Signal deep variant |
| `--signal-soft` | `rgba(0,18,36,0.08)` | Signal tint / now-highlight bg |
| `--hairline` | `rgba(0,18,36,0.10)` | Dividers / card borders |

## Dark mode
`[data-theme="dark"]` on `<html>` swaps: paper → `#080D12`, ink → `#F9F9F9`, surface → `#0D1520`, signal → `#E5DBC2` (beige as active highlight), brass → `#E5DBC2`. All components read CSS variables only.

## Accent rules
- **Beige `--brass` `#D1C5A9`** = secondary warm accent: rundown type badges, guided-check-in step numbers, avatars, schedule badge.
- **Navy `--signal` `#001224`** = primary action: CTA buttons (except login — login card uses beige button against dark navy background), active nav, live strip, now-marker, notification dots.
- **Login card special rule:** `.login-body .btn` is beige (`#E5DBC2`) with navy text so it contrasts against the dark navy card.

## Named brand colors (from frankfurtLandingPage.html)
| Name | Hex | Usage |
|------|-----|-------|
| Navy | `#001224` | Primary dark, hero bg, CTAs |
| Navy light | `#002244` | Gradient variant |
| Beige | `#E5DBC2` | Highlight accent, login button |
| Beige dark | `#D1C5A9` | Icon accent, badges |
| Gold edge | `#D4AF37` | Animated edge lights only (not used in app) |

## Typography
- **Playfair Display** (400–700, italic) — display / headings / seals / boarding-pass title.
- **Plus Jakarta Sans** (300–800) — body / UI / labels / buttons.

```
fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap
```

## Layout note
- **Mobile:** stacked screens, sticky topbar (with CIPES logo image), bottom nav, slide-in drawers.
- **Desktop (≥960px):** 3-column — **sidebar** (CIPES logo, vertical nav, theme toggle, sign-out) · **main canvas** (boarding-pass hero + screen content) · **right rail** (always-visible Updates feed).
