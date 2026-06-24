# CSCD Delegate App — Color Scheme

Palette extracted from the YPDS Jakarta 2026 page (`thecscd.org/ypds-jakarta-2026`).
**The app uses a minimalist diplomacy aesthetic** — warm cream + near-black, generous
whitespace and hairline rules, with the palette accents applied sparingly. (The source
page is maximalist; we keep its *colours*, not its heavy styling.)

## Core palette

| Token            | Hex       | Role |
|------------------|-----------|------|
| `--ink`          | `#050505` | Primary near-black — main text, dark backgrounds |
| `--ink-soft`     | `#0A0A0A` | Secondary black surfaces |
| `--charcoal`     | `#2C2825` | Warm dark brown — body text, borders |
| `--cream`        | `#F9F6F0` | Primary warm off-white background |
| `--white`        | `#FFFFFF` | Cards / pure white surfaces |
| `--yellow`       | `#E6EB1C` | **Primary accent** — chartreuse/electric yellow. Highlights, active states, hard offset shadows, CTAs |
| `--pink`         | `#EA0558` | **Secondary accent — USE SPARINGLY.** Rare emphasis only. Must NOT make the app feel "pink". |

## Accent rule
- **Primary accent = yellow `#E6EB1C`, used sparingly.** Reserve it for restrained touches — the active bottom-nav indicator, one CTA, a slim "now" marker, a soft text highlight (`box-shadow: inset 0 -0.4em 0 rgba(230,235,28,0.45)`), keynote/visit badge tints. Most surfaces stay cream/white/ink.
- **Pink `#EA0558` is a single signal, not a base.** In the minimalist build it is used essentially once — the small unread dot on the notification bell / Updates items (and inline form errors). It must NOT make the app feel "pink".

## Minimalist styling rules
- **No heavy/offset block shadows.** Use hairline borders (`rgba(5,5,5,0.10)`) and at most a very soft shadow (`0 1px 2px rgba(5,5,5,0.05)`) on cards.
- Rounded corners (8–14px), pill badges/tabs, lots of whitespace, lighter Cinzel weights (400/600).
- Separators are 1px hairlines, not thick borders.

## Supporting (from rgba usage)
- Lines / dividers: `rgba(5,5,5,0.10)`, `rgba(5,5,5,0.16)`
- Soft card shadow: `0 1px 2px rgba(5,5,5,0.05)`
- Scrims (overlays): `rgba(5,5,5,0.35)`–`rgba(5,5,5,0.45)`

## Typography
Loaded from Google Fonts on the source page:
- **Cinzel** (400/600/700/800) — display / headings. Elegant, classical, diplomatic.
- **Cormorant Garamond** (400/600, + italic) — serif accents / quotes / subtitles.
- **Lato** (300/400/700) — body / UI text.

```
fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Lato:wght@300;400;700&display=swap
```
