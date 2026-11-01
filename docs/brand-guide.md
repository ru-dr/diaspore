# Diaspore brand guide

How to use the Diaspore name, mark, and colors. All assets live in [`docs/assets`](assets).

<p align="center">
  <img src="assets/banner.svg" alt="Diaspore banner" width="100%">
</p>

## The idea

A diaspore is a seed, spore, or fruit that travels to start something new. Diaspore the tool
turns one seed into one exact failure. The mark is a single dandelion seed, drawn
in horizontal bars: the fan of filaments that carries it, the thin stalk, and the heavier seed
body at the base. It is tilted, mid-drift, and laid out on a strict row grid. A seed carried by
chance, placed on an exact grid, is the whole product in one picture.

It is one seed, not a whole dandelion head. Do not add more seeds or draw a full puffball.

**What the bars mean.** Each row is one tick of Diaspore's virtual clock. The rows never drift
and never overlap, because simulated time only moves when the clock is advanced. The bars inside
a row are events: where they land and how far they reach is what a seed decides. Same seed, same
bars. Treat the row grid as part of the meaning, not only as a style, and do not nudge rows
off it.

Tagline: **Seeds for failures.**
Descriptor: **Deterministic simulation and failure search for distributed systems.**

## Name

- Write it **Diaspore**, capital D, lowercase rest. Never `DIASPORE`, `DiaSpore`, or `diaspore`
  in prose.
- The CLI, module path, and code identifiers stay lowercase: `diaspore`.
- Do not pluralize or verb it ("we Diaspored it").

## Assets

| File | Use |
|---|---|
| [`banner.svg`](assets/banner.svg) | README header for light themes. White rounded card with a faint border, 1800×340. |
| [`banner-dark.svg`](assets/banner-dark.svg) | README header for dark themes. Near-black card, brighter seed, light wordmark. |
| [`logo-lockup.svg`](assets/logo-lockup.svg) | Mark plus wordmark on white, 16:9. Slides, covers. |
| [`logo-lockup-color.svg`](assets/logo-lockup-color.svg) | Lockup, transparent, color seed and dark wordmark. Light backgrounds. |
| [`logo-lockup-color-dark.svg`](assets/logo-lockup-color-dark.svg) | Lockup, transparent, brighter seed and light wordmark. Dark backgrounds. |
| [`logo-lockup-ink.svg`](assets/logo-lockup-ink.svg), [`logo-lockup-light.svg`](assets/logo-lockup-light.svg) | One-color lockups, dark or light. Print, stamps, anywhere color is not possible. |
| [`mark.svg`](assets/mark.svg) | Color seed on white, square. |
| [`mark-color.svg`](assets/mark-color.svg) | Color seed, transparent. |
| [`mark-ink.svg`](assets/mark-ink.svg), [`mark-light.svg`](assets/mark-light.svg) | One-color seed, dark or light, transparent. |
| [`favicon.svg`](assets/favicon.svg) | Bold color seed on a white tile for 16–64px: favicons, browser tabs. |
| [`favicon-32.png`](assets/favicon-32.png), [`apple-touch-icon.png`](assets/apple-touch-icon.png) | 32px and 180px renders of the favicon. |
| [`mark-small-ink.svg`](assets/mark-small-ink.svg), [`mark-small-light.svg`](assets/mark-small-light.svg) | Bold seed, transparent, for 16–32px where the standard mark's thin bars fade. |
| [`seed.txt`](assets/seed.txt) | The seed in terminal characters, 38 columns by 25 rows. |
| [`avatar.png`](assets/avatar.png) | 512×512 profile image for GitHub org, social accounts. |
| [`social-preview.png`](assets/social-preview.png) | 1280×640 GitHub social preview. Set under repo Settings, Social preview. |

Edit the SVGs, not the PNGs. Regenerate PNGs with `rsvg-convert`:

```sh
rsvg-convert -w 512  -o docs/assets/avatar.png docs/assets/mark.svg
```

The wordmark is outlined paths, not live text, set in Milling Duplex 1mm (Milling Trial, 205TF). Do not retype it or swap the font. The font files are a trial release and are not in this repo.

## Color

Neutral ground, color inside the seed. The background stays plain so the seed carries all the
color.

| Name | Hex | Use |
|---|---|---|
| Ink | `#1A1A18` | Wordmark, one-color mark, body text on light |
| White | `#FFFFFF` | Banner, lockup, and tile ground |
| Paper | `#F5F4F0` | Light ink on dark, soft surfaces |
| Border | `#E6E3DC` | The faint outline on white cards |
| Seed green | `#5FD85A` | Top of the seed gradient |
| Seed amber | `#EDB52B` | Middle of the seed gradient |
| Seed coral | `#F26B5E` | Bottom of the seed gradient |

### The seed gradient

The seed is filled with one vertical gradient across its full height, from the top bar to the
base bar: green at the head, amber through the stalk's middle, coral at the base. Stops are at
0%, 45%, and 100%.

- On dark backgrounds use the brighter set: `#9CF27A`, `#FFE27A`, `#FF9E8A`.
- The wordmark is never filled with the gradient. It is Ink on light and Paper on dark.
- Do not put the colors on the background. A saturated band behind thin bars fights them.
- The middle amber is deepened from a pure yellow so thin bars stay readable on white.
- For one-color uses (print, stamps), use the Ink or Paper files.

## Logo

### Clear space

Keep empty space of at least **X** on every side, where X is the height of the capital D in the
wordmark. Nothing else, including edges of the page, enters that margin.

### Minimum size

| Asset | Minimum |
|---|---|
| Lockup | 120px wide |
| Mark alone (`mark-*.svg`) | 24px wide |
| Bold seed (`mark-small-*.svg`, `favicon.svg`) | 16px wide |

Tested at 16, 24, 32, and 48px. The standard mark reads as a seed down to about 24px. At 16px
its thin bars fade to gray, and around 48px the bars can alias into banding on low-resolution
screens. Below 24px use the bold seed: its rows touch, so the rays become solid shapes and the
stalk one line.

### Which file where

- White or light background: `logo-lockup-color.svg`, `mark-color.svg`.
- Dark background: `logo-lockup-color-dark.svg`.
- One color only: `logo-lockup-ink.svg`, `mark-ink.svg` (dark), `*-light.svg` (light).
- Photo or busy background: place the lockup on a white card, never directly on the image.

### Banner

- Corner radius is 14 on the 1800px-wide artboard, about 7px at README width.
- GitHub renders the README column about 888px wide. The 5.3:1 ratio keeps the banner near
  170px tall there.
- Alignment follows the rule below.
- The README switches banners by theme with a `<picture>` element: `banner-dark.svg` when the
  viewer prefers dark, `banner.svg` otherwise. Keep the two files identical in layout so nothing
  shifts when the theme changes.

### Alignment rule

One rule drives every asset, so the lockup looks the same everywhere:

- **Wordmark vs mark:** the wordmark sits 0.2 cap-heights below its original position. That is
  16px in the banner and 24px in the 1600px lockup. The middle of the capital D then falls
  near the middle of the lockup, not up at the seed head.
- **Horizontal:** centered halfway between the bounding-box center and the ink-weight center.
  The mark is sparse on its left, so a pure box-center looks left-heavy.
- **Vertical:** the middle of the capital D sits on the canvas center line.
- **Mark alone, favicon, and avatar:** centered 70% on the bounding box and 30% on the
  ink-weight center, on both axes. The seed's weight is in its head, so a pure box center looks
  low and a full weight center looks high. The tile is sized so the seed fills about three
  quarters of it, which leaves proportionate margins on all four sides.
- **Transparent files** (`*-ink`, `*-light`) are cropped to the artwork with equal padding, so
  they are box-centered by construction. They keep the same wordmark offset.

### Mark grid

The mark's bars sit on an exact row grid: bar height 10, row pitch 14.25, so the gap between
rows is 4.25 and every row spacing matches. Gaps between bars in the same row are at least 8.
Keep both when editing. Rounding row positions to whole pixels makes spacing flicker between
two values, and tighter in-row gaps clog the center of the head.

### Don't

- Don't recolor the wordmark outside Ink and Paper. The seed uses only the seed gradient, or one color in Ink or Paper.
- Don't stretch, rotate, outline, or add shadows.
- Don't thicken the wordmark.
- Don't place the seed on a green, amber, or coral background. It disappears.
- Don't rearrange the lockup, such as stacking text under the mark. Ask first if a layout needs it.
- Don't redraw the mark's bars. The bar height, gap, and radius are what make it read as one object.

## Terminal

[`assets/seed.txt`](assets/seed.txt) is the seed drawn with `━` bars and `▪` dots, one text line
per row of the mark, so it keeps the row grid. It is 38 columns by 25 rows, which is too tall for
a routine header. Use it for `diaspore --version` and the first-run screen, and print only the
name on ordinary commands. It must render in a plain terminal with no color. If color is used,
it is the terminal default color only, never the seed colors as text.

## Typography

The wordmark carries the brand type, Milling Duplex 1mm. For everything else use a neutral grotesque sans such as
Inter, or the system sans-serif, and the system monospace for code. Keep headings in sentence
case.

## Voice

Plain, specific, a little dry. State what the tool does and what it does not do yet.

- Say "same seed, same execution". Do not say "revolutionary" or "AI-powered".
- Describe status honestly: the README says "in development" until it is not.
- Lead with the failure, not the feature.

## Applying it

| Place | Asset |
|---|---|
| README header | `banner.svg` and `banner-dark.svg`, switched with `<picture>` |
| GitHub social preview | `social-preview.png` |
| GitHub org or account avatar | `avatar.png` |
| Slides, covers | `logo-lockup.svg` |
| Docs on dark theme | `logo-lockup-color-dark.svg` |
| Print, one color | `logo-lockup-ink.svg` |
