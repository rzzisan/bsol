# Ad creative generator

Generates the platform's Facebook/Instagram ad creative set (and the
homepage's `og-banner.png`-style images) — a set of static PNGs sized and
styled per platform/placement/feature, without needing any image-generation
tool or headless browser. See `homepage_redesign_context.md` in the repo
root for the full backstory on why this exists and how it was built.

## Usage

```bash
cd frontend/scripts/ad-creatives
python3 gen_ads.py    # writes ./svg/*.svg (source of truth, hand-tunable)
node rasterize.js     # rasterizes every ./svg/*.svg into ./png/*.png
```

`./svg` and `./png` are build output (gitignored) — regenerate them, don't
commit them. Copy whichever finished PNGs you actually need out of `./png`
into `frontend/public/` (for anything the app itself serves, e.g. the OG
banner) or hand them directly to whoever is setting up the ad campaign.

## How it works

- `gen_ads.py` hand-writes one SVG per (size, feature theme, color style)
  combination — see `MANIFEST` at the bottom of the file — using two layout
  functions (`render_landscape` for the 1200×630 hero-split format,
  `render_stack` for square/portrait/story's centered vertical format) plus
  a compact `render_thumbnail`.
- `rasterize.js` rasterizes each SVG to PNG at its declared size via
  `sharp` (already a transitive Next.js dependency — nothing extra to
  install).
- All copy is in `THEMES` — one dict per feature pillar (payments, courier,
  fraud protection, marketing, etc.), grounded in what's actually shipped
  (payment gateway/courier names came from `PaymentGatewayFactory`/
  `CourierFactory`, not invented). Add a new theme there, add a row to
  `MANIFEST` with the size/style/layout you want it in, rerun.

## Bangla font dependency

SVG rasterizers don't fetch web fonts (no `@import`/`<link>` support like a
real browser) — they need the font installed where fontconfig can find it.
This machine has no Bangla-capable font by default. Fixed by copying the
`NotoSansBengali-{Regular,Bold}.ttf` files already sitting in
`backend/storage/fonts/` (downloaded earlier for the PDF-invoice feature)
into `~/.local/share/fonts/`. If you're running this fresh on a machine
that doesn't have that yet:

```bash
mkdir -p ~/.local/share/fonts
cp ../../../backend/storage/fonts/NotoSansBengali-{Regular,Bold}.ttf ~/.local/share/fonts/
```

`fc-cache`/`fc-list` (fontconfig's CLI tools) aren't installed on this box
and weren't needed — `libfontconfig1` (which *is* installed, and which
`sharp`'s SVG rasterizer links against) still discovers fonts in standard
XDG directories via a live scan even with no prebuilt cache.

## Text sizing — read before editing copy

SVG `<text>` has no auto-wrap and no reliable intrinsic-width query from
Python, so:
- **Headlines and thumbnail taglines are centered** with `text-anchor="middle"`
  at a fixed `x` — never hand-computed `x = cx - width/2`. An earlier pass
  tried that and got it visibly wrong on multi-conjunct Bangla strings
  (complex glyph clusters don't match a simple per-character width
  estimate); `text-anchor="middle"` needs no width estimate at all and
  can't have that class of bug.
- **Chip pills and badges** *do* use an estimated width (`seg_width()`) to
  size their background rect and to greedy-wrap chips into rows
  (`wrap_chips()`) — there's no way around measuring for those, since the
  pill has to be sized to its own text. A `SAFETY` multiplier (~1.15–1.2)
  pads the estimate; if you add a much longer chip label and it looks
  cramped or clips, increase `SAFETY` in that render function rather than
  fighting the per-character constants in `seg_width()`.
- If you change `head_font`'s ratio-of-width in `render_stack`, keep it
  near the proven `54/1200 ≈ 0.045–0.052` range the landscape layout
  already validated — the first attempt at a much larger ratio for the
  taller formats overflowed both canvas edges.
