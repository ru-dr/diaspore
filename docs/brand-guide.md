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
| [`banner.svg`](assets/banner.svg) | README header. Rounded corners, 1800×340, transparent outside the corners. |
| [`logo-lockup.svg`](assets/logo-lockup.svg) | Mark plus wordmark on the brand gradient, 16:9. Slides, covers. |
| [`logo-lockup-ink.svg`](assets/logo-lockup-ink.svg) | Lockup, transparent, dark ink. Light backgrounds. |
| [`logo-lockup-light.svg`](assets/logo-lockup-light.svg) | Lockup, transparent, light ink. Dark backgrounds. |
| [`mark.svg`](assets/mark.svg) | Mark on the brand gradient, square. |
| [`mark-ink.svg`](assets/mark-ink.svg) | Mark only, transparent, dark ink. |
| [`mark-light.svg`](assets/mark-light.svg) | Mark only, transparent, light ink. |
| [`favicon.svg`](assets/favicon.svg) | Bold seed on a gradient tile for 16–64px: favicons, browser tabs. |
| [`favicon-32.png`](assets/favicon-32.png), [`apple-touch-icon.png`](assets/apple-touch-icon.png) | 32px and 180px renders of the favicon. |
| [`mark-small-ink.svg`](assets/mark-small-ink.svg), [`mark-small-light.svg`](assets/mark-small-light.svg) | Bold seed, transparent, for 16–32px where the standard mark's thin bars fade. |
| [`seed.txt`](assets/seed.txt) | The seed in terminal characters, 38 columns by 25 rows. |
| [`avatar.png`](assets/avatar.png) | 512×512 profile image for GitHub org, social accounts. |
| [`social-preview.png`](assets/social-preview.png) | 1280×640 GitHub social preview. Set under repo Settings, Social preview. |

Edit the SVGs, not the PNGs. Regenerate PNGs with `rsvg-convert`:

```sh
rsvg-convert -w 512  -o docs/assets/avatar.png docs/assets/mark.svg
```

The wordmark is outlined paths, not live text. Do not retype it or swap the font.

## Color

| Name | Hex | RGB | Use |
|---|---|---|---|
| Charcoal | `#1D1C1B` | 29, 28, 27 | Mark, wordmark, body text on light |
| Chalk | `#F4F3F3` | 244, 243, 243 | Light surfaces, light ink on dark |
| Green | `#60E21B` | 96, 226, 27 | The saturated accent, center of the gradient |
| Orange | `#FABA17` | 250, 186, 23 | Gradient transition |
| Peach | `#FFB592` | 255, 181, 146 | Gradient transition |
| Pink | `#FFB0CD` | 255, 176, 205 | Gradient bottom |

This palette is deliberately the same as TwelveLabs' published brand colors, taken from their
brand page. The mark's bar style is inspired by theirs, the single-seed idea and the clock-tick meaning
are Diaspore's own.

Charcoal and Chalk do the work. Green, Orange, Peach, and Pink appear only inside the gradient.
Do not use them as flat fills, button colors, or text colors.

### The gradient

Vertical, top to bottom. Stops are interpolated in OKLab, so the steps look even, and sampled
below at each 10%:

| Position | Color |
|---|---|
| 0% to 30% | `#F4F3F3` (Chalk) |
| 40% | `#D3F0C9` |
| 50% | `#8FE86F` |
| 60% | `#60E21B` (Green) |
| 70% | `#BCD019` |
| 80% | `#FABA17` (Orange) |
| 90% | `#FFB592` (Peach) |
| 100% | `#FFB0CD` (Pink) |

Chalk holds for the top 30%, eases into Green by 60%, then Orange at 80%, Peach at 90%, and Pink
at the bottom. If the gradient is cropped or resized, stretch the whole thing to the new height.
Do not cut off an end. The banner is the original 450px gradient squeezed into 340px this way.

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

- Light background: `logo-lockup-ink.svg`, `mark-ink.svg`.
- Dark background: `logo-lockup-light.svg`, `mark-light.svg`.
- Photo or busy background: put the lockup on the gradient version, never directly on the image.

### Banner

- Corner radius is 14 on the 1800px-wide artboard, about 7px at README width.
- GitHub renders the README column about 888px wide. The 5.3:1 ratio keeps the banner near
  170px tall there.
- Alignment follows the rule below.

### Alignment rule

One rule drives every asset, so the lockup looks the same everywhere:

- **Wordmark vs mark:** the wordmark sits 0.2 cap-heights below its original position. That is
  16px in the banner and 24px in the 1600px lockup. The middle of the capital D then falls
  near the middle of the lockup, not up at the seed head.
- **Horizontal:** centered halfway between the bounding-box center and the ink-weight center.
  The mark is sparse on its left, so a pure box-center looks left-heavy.
- **Vertical:** the middle of the capital D sits on the canvas center line.
- **Mark alone:** centered halfway between box center and ink-weight center on both axes.
- **Transparent files** (`*-ink`, `*-light`) are cropped to the artwork with equal padding, so
  they are box-centered by construction. They keep the same wordmark offset.

### Mark grid

The mark's bars sit on an exact row grid: bar height 10, row pitch 14.25, so the gap between
rows is 4.25 and every row spacing matches. Gaps between bars in the same row are at least 8.
Keep both when editing. Rounding row positions to whole pixels makes spacing flicker between
two values, and tighter in-row gaps clog the center of the head.

### Don't

- Don't recolor the mark or wordmark outside Charcoal and Chalk.
- Don't stretch, rotate, outline, or add shadows.
- Don't thicken the wordmark.
- Don't place the mark on a flat green, salmon, or red background.
- Don't rearrange the lockup, such as stacking text under the mark. Ask first if a layout needs it.
- Don't redraw the mark's bars. The bar height, gap, and radius are what make it read as one object.

## Terminal

[`assets/seed.txt`](assets/seed.txt) is the seed drawn with `━` bars and `▪` dots, one text line
per row of the mark, so it keeps the row grid. It is 38 columns by 25 rows, which is too tall for
a routine header. Use it for `diaspore --version` and the first-run screen, and print only the
name on ordinary commands. It must render in a plain terminal with no color. If color is used,
it is Charcoal-on-default only, never the gradient colors as text.

## Typography

The wordmark carries the brand type. For everything else use a neutral grotesque sans such as
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
| README header | `banner.svg` |
| GitHub social preview | `social-preview.png` |
| GitHub org or account avatar | `avatar.png` |
| Slides, covers | `logo-lockup.svg` |
| Docs on dark theme | `logo-lockup-light.svg` |
| Print, one-color | `logo-lockup-ink.svg` |
