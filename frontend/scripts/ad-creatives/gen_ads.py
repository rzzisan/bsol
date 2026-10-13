import base64, os, math

# Regenerate the whole ad-creative set:
#   python3 gen_ads.py && node rasterize.js
# Output lands in ./svg (intermediate) and ./png (final, gitignored — these
# are one-off marketing assets, not app runtime files). See this directory's
# README.md and homepage_redesign_context.md for the design rationale.
ROOT = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = f"{ROOT}/svg"
FONT = "Hind Siliguri, sans-serif"

LOGO_PATH = os.path.join(ROOT, "..", "..", "public", "app-icon-1024.png")
with open(LOGO_PATH, "rb") as f:
    LOGO_B64 = base64.b64encode(f.read()).decode("ascii")

# ---------------------------------------------------------------------------
# Colors per style
# ---------------------------------------------------------------------------
def colors(style):
    if style == "light":
        return dict(
            bg1="#f4f0e8", bg2="#fff8ef", bg3="#f4f0e8",
            accent="#0f7c7b", accent_bright="#0c625f",
            fg="#1b1f2a", muted="#657089",
            chip_bg="#ffffff", chip_border="rgba(199,203,215,0.7)", chip_text="#1b1f2a",
            badge_bg="rgba(15,124,123,0.10)", badge_border="rgba(15,124,123,0.4)", badge_text="#0f7c7b",
            cta1="#0f7c7b", cta2="#0c625f", cta_text="#ffffff",
            glow="#0f7c7b", grid="rgba(27,31,42,0.05)", frame="rgba(27,31,42,0.08)",
        )
    return dict(
        bg1="#0f1523", bg2="#101a2c", bg3="#0c1220",
        accent="#19a59c", accent_bright="#38d9c9",
        fg="#ffffff", muted="#8b97b3",
        chip_bg="rgba(255,255,255,0.07)", chip_border="rgba(255,255,255,0.16)", chip_text="#e8edf8",
        badge_bg="rgba(25,165,156,0.16)", badge_border="rgba(25,165,156,0.45)", badge_text="#6fe0d4",
        cta1="#19a59c", cta2="#12857e", cta_text="#ffffff",
        glow="#19a59c", grid="rgba(255,255,255,0.035)", frame="rgba(255,255,255,0.08)",
    )

# ---------------------------------------------------------------------------
# Text helpers (SVG has no auto layout — hand-estimated widths)
# ---------------------------------------------------------------------------
def seg_width(text, size, weight_bold=True):
    w = 0.0
    for ch in text:
        if ch == " ":
            w += size * 0.32
        elif ord(ch) < 128:
            w += size * (0.62 if weight_bold else 0.56)
        else:
            w += size * (0.70 if weight_bold else 0.64)
    return w

def parse_accent(line, accent_color, fg_color):
    """Split '...|accent word|...' into tspans."""
    parts = line.split("|")
    out = []
    for i, p in enumerate(parts):
        if not p:
            continue
        color = accent_color if i % 2 == 1 else fg_color
        out.append((p, color))
    return out

def headline_tspans(line, accent_color, fg_color, x):
    segs = parse_accent(line, accent_color, fg_color)
    tspans = []
    for text, color in segs:
        tspans.append(f'<tspan fill="{color}">{text}</tspan>')
    return "".join(tspans)

def headline_plain_width(line, size):
    return seg_width(line.replace("|", ""), size, True)

def wrap_chips(chips, size, max_width, gap, pad_x, safety=1.0):
    """Greedy-wrap chip labels into centered rows that fit max_width."""
    rows, row, row_w = [], [], 0.0
    for label in chips:
        w = seg_width(label, size, True) * safety + pad_x * 2
        if row and row_w + gap + w > max_width:
            rows.append(row)
            row, row_w = [], 0.0
        row.append((label, w))
        row_w += (gap if row_w > 0 else 0) + w
    if row:
        rows.append(row)
    return rows

def chip_row_svg(rows, cx, y0, row_h, row_gap, gap, pad_x, size, c, safety=1.0):
    out = []
    y = y0
    for row in rows:
        total_w = sum(w for _, w in row) + gap * (len(row) - 1)
        x = cx - total_w / 2
        for label, w in row:
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{row_h}" rx="{row_h/2:.1f}" fill="{c["chip_bg"]}" stroke="{c["chip_border"]}"/>')
            out.append(f'<text x="{x + w/2:.1f}" y="{y + row_h/2 + size*0.35:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{size}" font-weight="600" fill="{c["chip_text"]}">{label}</text>')
            x += w + gap
        y += row_h + row_gap
    return "".join(out), y - row_gap

def defs_block(c, w, h):
    return f'''
  <defs>
    <radialGradient id="glow1" cx="10%" cy="8%" r="45%">
      <stop offset="0%" stop-color="{c['glow']}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="{c['glow']}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="92%" cy="94%" r="45%">
      <stop offset="0%" stop-color="{c['glow']}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="{c['glow']}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c['bg1']}"/>
      <stop offset="55%" stop-color="{c['bg2']}"/>
      <stop offset="100%" stop-color="{c['bg3']}"/>
    </linearGradient>
    <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c['cta1']}"/>
      <stop offset="100%" stop-color="{c['cta2']}"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="{c['grid']}" stroke-width="1"/>
    </pattern>
    <clipPath id="logoClip"><rect x="0" y="0" width="1" height="1" rx="0.24"/></clipPath>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#bg)"/>
  <rect width="{w}" height="{h}" fill="url(#grid)"/>
  <rect width="{w}" height="{h}" fill="url(#glow1)"/>
  <rect width="{w}" height="{h}" fill="url(#glow2)"/>
  <rect width="{w}" height="{h}" fill="none" stroke="{c['frame']}" stroke-width="2"/>'''

def logo_group(x, y, size, brand_size, c):
    r = size * 0.25
    return f'''
  <g transform="translate({x},{y})">
    <clipPath id="lc-{x}-{y}"><rect x="0" y="0" width="{size}" height="{size}" rx="{r}"/></clipPath>
    <g clip-path="url(#lc-{x}-{y})"><image href="data:image/png;base64,{LOGO_B64}" width="{size}" height="{size}"/></g>
    <rect x="0" y="0" width="{size}" height="{size}" rx="{r}" fill="none" stroke="{c['frame']}"/>
    <text x="{size + size*0.27}" y="{size*0.64}" font-family="{FONT}" font-size="{brand_size}" font-weight="800" fill="{c['fg']}">Zyrotech BSOL</text>
  </g>'''

# ---------------------------------------------------------------------------
# Layout: landscape (1200x630-ish, hero split)
# ---------------------------------------------------------------------------
def render_landscape(w, h, theme, style):
    c = colors(style)
    m = 64
    logo_y = m
    logo_size = 52
    badge_y = 128
    head_y0 = 232
    line_h = 64
    chip_y = head_y0 + line_h * len(theme["headline"]) + 24
    chip_h = 46
    accent = c["accent_bright"]

    chips_svg = []
    x = m
    for label in theme["chips"]:
        cw = seg_width(label, 15.5, True) + 40
        chips_svg.append(f'<rect x="{x:.1f}" y="{chip_y}" width="{cw:.1f}" height="{chip_h}" rx="12" fill="{c["chip_bg"]}" stroke="{c["chip_border"]}"/>')
        chips_svg.append(f'<text x="{x+cw/2:.1f}" y="{chip_y+chip_h/2+5.5}" text-anchor="middle" font-family="{FONT}" font-size="15.5" font-weight="600" fill="{c["chip_text"]}">{label}</text>')
        x += cw + 14

    headline_svg = []
    for i, line in enumerate(theme["headline"]):
        headline_svg.append(f'<text x="{m}" y="{head_y0 + i*line_h}" font-family="{FONT}" font-size="54" font-weight="800">{headline_tspans(line, accent, c["fg"], m)}</text>')

    bottom_y = h - 150
    stats_svg = ""
    if theme.get("stats"):
        sx = m
        parts = []
        for num, label in theme["stats"]:
            parts.append(f'<text x="{sx}" y="{bottom_y+30}" font-family="{FONT}" font-size="30" font-weight="800" fill="{c["fg"]}">{num}</text>')
            parts.append(f'<text x="{sx}" y="{bottom_y+56}" font-family="{FONT}" font-size="15" fill="{c["muted"]}">{label}</text>')
            sx += 106
        stats_svg = "".join(parts)
    elif theme.get("subtext"):
        stats_svg = f'<text x="{m}" y="{bottom_y+30}" font-family="{FONT}" font-size="18" fill="{c["muted"]}"><tspan x="{m}" dy="0">{theme["subtext"]}</tspan></text>'

    cta_w, cta_h = 260, 60
    cta_x, cta_y = w - m - cta_w, bottom_y
    cta_svg = f'''
  <rect x="{cta_x}" y="{cta_y}" width="{cta_w}" height="{cta_h}" rx="16" fill="url(#ctaGrad)"/>
  <text x="{cta_x+cta_w/2}" y="{cta_y+cta_h/2+7}" text-anchor="middle" font-family="{FONT}" font-size="20" font-weight="800" fill="{c['cta_text']}">{theme["cta"]}</text>'''

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" xml:space="preserve">
  {defs_block(c, w, h)}
  {logo_group(m, logo_y, logo_size, 26, c)}
  <rect x="{m}" y="{badge_y}" width="{seg_width(theme['badge'],17,True)+48:.0f}" height="42" rx="21" fill="{c['badge_bg']}" stroke="{c['badge_border']}"/>
  <text x="{m+24}" y="{badge_y+27}" font-family="{FONT}" font-size="17" font-weight="700" fill="{c['badge_text']}">{theme['badge']}</text>
  {''.join(headline_svg)}
  {''.join(chips_svg)}
  {stats_svg}
  {cta_svg}
</svg>'''

# ---------------------------------------------------------------------------
# Layout: stack (square / portrait / story — centered, vertical)
# ---------------------------------------------------------------------------
def render_stack(w, h, theme, style, compact=False):
    c = colors(style)
    cx = w / 2
    accent = c["accent_bright"]
    m = int(w * 0.09)
    SAFETY = 1.18  # width-estimate is approximate; pad generously to avoid overflow

    logo_size = int(w * 0.075)
    logo_y = int(h * 0.07)
    logo_x = cx - (logo_size + logo_size*0.27 + seg_width("Zyrotech BSOL", logo_size*0.5, True)) / 2
    y = logo_y + logo_size + int(h * 0.05)

    badge_font = max(15, int(w * 0.017))
    badge_w = min(w - 2*m, seg_width(theme["badge"], badge_font, True) * SAFETY + 52)
    badge_h = badge_font + 26
    badge_y = y
    y = badge_y + badge_h + int(h * 0.06)

    # Headline sized conservatively (same ratio the proven 1200-wide landscape
    # layout uses: 54/1200 ≈ 0.045) rather than guessed larger — SVG text has
    # no reflow, so oversizing here is what caused the very first square
    # render to overflow both edges.
    head_font = int(w * 0.052)
    line_h = int(head_font * 1.25)
    y += head_font
    headline_svg = []
    for i, line in enumerate(theme["headline"]):
        # text-anchor="middle" centers the whole run (including accent
        # tspans) natively — no width estimate needed, so complex Bangla
        # conjunct clusters (which broke the earlier estimate-and-offset
        # approach) can't misalign this.
        headline_svg.append(f'<text x="{cx}" y="{y + i*line_h}" text-anchor="middle" font-family="{FONT}" font-size="{head_font}" font-weight="800">{headline_tspans(line, accent, c["fg"], cx)}</text>')
    y += (len(theme["headline"]) - 1) * line_h + int(h * 0.05)

    subtext_svg = ""
    if theme.get("subtext"):
        sub_font = int(w * 0.024)
        y += sub_font
        subtext_svg = f'<text x="{cx}" y="{y}" text-anchor="middle" font-family="{FONT}" font-size="{sub_font}" fill="{c["muted"]}">{theme["subtext"]}</text>'
        y += int(h * 0.035)

    chip_font = max(15, int(w * 0.021))
    chip_h = int(chip_font * 2.6)
    chip_gap = int(w * 0.018)
    row_gap = int(h * 0.016)
    y += int(h * 0.045)
    rows = wrap_chips(theme["chips"], chip_font, w - 2*m, chip_gap, chip_font*1.1, safety=SAFETY)
    chips_svg, chips_bottom = chip_row_svg(rows, cx, y, chip_h, row_gap, chip_gap, chip_font*1.1, chip_font, c, safety=SAFETY)

    cta_w, cta_h = int(w * 0.46), int(h * 0.058)
    cta_font = int(cta_h * 0.40)
    cta_y = max(chips_bottom + int(h * 0.05), h - int(h * 0.11) - cta_h)
    cta_x = cx - cta_w / 2
    cta_svg = f'''
  <rect x="{cta_x:.1f}" y="{cta_y:.1f}" width="{cta_w}" height="{cta_h}" rx="{cta_h/2.5:.1f}" fill="url(#ctaGrad)"/>
  <text x="{cx}" y="{cta_y+cta_h/2+cta_font*0.35:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{cta_font}" font-weight="800" fill="{c['cta_text']}">{theme["cta"]}</text>'''

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" xml:space="preserve">
  {defs_block(c, w, h)}
  {logo_group(logo_x, logo_y, logo_size, logo_size*0.5, c)}
  <rect x="{cx-badge_w/2:.1f}" y="{badge_y}" width="{badge_w:.1f}" height="{badge_h}" rx="{badge_h/2:.1f}" fill="{c['badge_bg']}" stroke="{c['badge_border']}"/>
  <text x="{cx}" y="{badge_y+badge_h/2+badge_font*0.35:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{badge_font}" font-weight="700" fill="{c['badge_text']}">{theme['badge']}</text>
  {''.join(headline_svg)}
  {subtext_svg}
  {chips_svg}
  {cta_svg}
</svg>'''

# ---------------------------------------------------------------------------
# Layout: thumbnail (small compact square, e.g. 400x400)
# ---------------------------------------------------------------------------
def render_thumbnail(w, h, theme, style):
    c = colors(style)
    cx = w / 2
    accent = c["accent_bright"]

    logo_size = int(w * 0.20)
    logo_x = cx - logo_size / 2
    logo_y = int(h * 0.12)

    SAFETY = 1.18
    tagline_font = int(w * 0.072)
    tag_y0 = logo_y + logo_size + int(h * 0.16)
    tag_lines = theme.get("tag", theme["headline"][:2])
    line_h = int(tagline_font * 1.25)

    headline_svg = []
    for i, line in enumerate(tag_lines):
        headline_svg.append(f'<text x="{cx}" y="{tag_y0 + i*line_h}" text-anchor="middle" font-family="{FONT}" font-size="{tagline_font}" font-weight="800">{headline_tspans(line, accent, c["fg"], cx)}</text>')

    brand_font = int(w * 0.065)
    brand_y = tag_y0 + (len(tag_lines) - 1) * line_h + int(h * 0.13)

    cta_w, cta_h = int(w * 0.62), int(h * 0.14)
    cta_font = int(cta_h * 0.34)
    cta_x = cx - cta_w / 2
    # Flow below the brand line rather than a fixed bottom anchor — a fixed
    # anchor collided with the brand text when the tagline ran to 2 lines.
    cta_y = max(brand_y + int(h * 0.08), h - int(h * 0.14) - cta_h)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" xml:space="preserve">
  {defs_block(c, w, h)}
  {logo_group(logo_x, logo_y, logo_size, 0.001, c)}
  {''.join(headline_svg)}
  <text x="{cx}" y="{brand_y}" text-anchor="middle" font-family="{FONT}" font-size="{brand_font}" font-weight="700" fill="{c['muted']}">Zyrotech BSOL</text>
  <rect x="{cta_x:.1f}" y="{cta_y:.1f}" width="{cta_w}" height="{cta_h}" rx="{cta_h/2.5:.1f}" fill="url(#ctaGrad)"/>
  <text x="{cx}" y="{cta_y+cta_h/2+cta_font*0.35:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{cta_font}" font-weight="800" fill="{c['cta_text']}">{theme["cta"]}</text>
</svg>'''

# ---------------------------------------------------------------------------
# Layout: Facebook Page profile picture (square, displayed as a circle —
# keep everything inside a centered "circle-safe" zone so the round crop
# never clips it).
# ---------------------------------------------------------------------------
def render_profile(w, h, style):
    c = colors(style)
    cx, cy = w / 2, h / 2
    r = min(w, h) / 2

    # Inscribed-square side length for this circle, times a further margin
    # so the mark sits well clear of the crop edge rather than touching it.
    safe = r * math.sqrt(2) * 0.72
    logo_size = safe
    logo_x, logo_y = cx - logo_size / 2, cy - logo_size / 2

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" xml:space="preserve">
  <defs>
    <radialGradient id="pbg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="{c['bg2']}"/>
      <stop offset="100%" stop-color="{c['bg1']}"/>
    </radialGradient>
    <clipPath id="plogo"><rect x="0" y="0" width="{logo_size}" height="{logo_size}" rx="{logo_size*0.22}"/></clipPath>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#pbg)"/>
  <g transform="translate({logo_x:.1f},{logo_y:.1f})">
    <g clip-path="url(#plogo)"><image href="data:image/png;base64,{LOGO_B64}" width="{logo_size}" height="{logo_size}"/></g>
  </g>
</svg>'''

# ---------------------------------------------------------------------------
# Layout: Facebook Page cover photo (820x312 — wide and short). The Page's
# profile picture visually overlaps the bottom-left corner on both desktop
# and mobile, so all content here is deliberately kept clear of a left
# margin sized for that, and it's a single compact line stack (no room for
# a hero + chips + CTA the way the 1200x630 landscape layout has).
# ---------------------------------------------------------------------------
def render_cover(w, h, theme, style):
    c = colors(style)
    accent = c["accent_bright"]
    SAFETY = 1.18
    safe_left = int(w * 0.27)  # clears the profile-picture overlap zone
    right_margin = int(w * 0.05)
    avail_w = w - safe_left - right_margin
    cx = safe_left + avail_w / 2

    badge_font = max(12, int(h * 0.05))
    while seg_width(theme["badge"], badge_font, True) * SAFETY + 36 > avail_w and badge_font > 10:
        badge_font -= 1
    badge_w = min(avail_w, seg_width(theme["badge"], badge_font, True) * SAFETY + 36)
    badge_h = badge_font + 16
    badge_y = int(h * 0.12)
    badge_x = cx - badge_w / 2

    # Shrink-to-fit: 820x312 is far too tight to fit a full two-clause
    # headline at a size proportional to height alone (that's what the
    # first pass did, and it overflowed both edges) — cap the font so the
    # *widest* estimated line actually fits avail_w.
    headline = theme["cover_headline"]
    head_font = int(h * 0.155)
    while headline_plain_width(headline, head_font) * SAFETY > avail_w and head_font > 14:
        head_font -= 1
    head_y = badge_y + badge_h + int(h * 0.13) + head_font * 0.8

    subtext = theme.get("cover_subtext", " · ".join(theme["chips"][:2]))
    sub_font = int(h * 0.058)
    while seg_width(subtext, sub_font, True) * SAFETY > avail_w and sub_font > 11:
        sub_font -= 1
    sub_y = head_y + int(h * 0.15)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" xml:space="preserve">
  {defs_block(c, w, h)}
  <rect x="{badge_x:.1f}" y="{badge_y}" width="{badge_w:.1f}" height="{badge_h}" rx="{badge_h/2:.1f}" fill="{c['badge_bg']}" stroke="{c['badge_border']}"/>
  <text x="{cx}" y="{badge_y+badge_h/2+badge_font*0.35:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{badge_font}" font-weight="700" fill="{c['badge_text']}">{theme['badge']}</text>
  <text x="{cx}" y="{head_y:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{head_font}" font-weight="800">{headline_tspans(headline, accent, c['fg'], cx)}</text>
  <text x="{cx}" y="{sub_y:.1f}" text-anchor="middle" font-family="{FONT}" font-size="{sub_font}" font-weight="600" fill="{c['muted']}">{subtext}</text>
</svg>'''

# ---------------------------------------------------------------------------
# Themes (all copy grounded in actually-shipped features — payment gateway
# and courier names cross-checked against PaymentGatewayFactory/CourierFactory
# the same way the homepage redesign was, homepage_redesign_context.md).
# Headline accent word(s) marked with |pipes|.
# ---------------------------------------------------------------------------
THEMES = {
    "master": dict(
        badge="বাংলাদেশের F-commerce ব্যবসার জন্য অল-ইন-ওয়ান প্ল্যাটফর্ম",
        headline=["অর্ডার থেকে |প্রফিট| —", "পুরো ব্যবসা এক ড্যাশবোর্ডে"],
        tag=["অর্ডার থেকে", "|প্রফিট|"],
        cover_headline="অর্ডার থেকে |প্রফিট| — পুরো ব্যবসা এক ড্যাশবোর্ডে",
        chips=["৫টি কুরিয়ার", "৭টি পেমেন্ট গেটওয়ে", "ফেইক-অর্ডার প্রোটেকশন", "Facebook + WhatsApp মার্কেটিং"],
        stats=[("৫+", "কুরিয়ার পার্টনার"), ("৭+", "পেমেন্ট গেটওয়ে"), ("২৪/৭", "ড্যাশবোর্ড অ্যাক্সেস")],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "courier": dict(
        badge="৫টি কুরিয়ার — এক ড্যাশবোর্ড",
        headline=["সব কুরিয়ার, সব অর্ডার", "|এক জায়গায়| ট্র্যাক করুন"],
        chips=["Pathao", "Steadfast", "RedX", "Carrybee", "Paperfly"],
        stats=[("৫টি", "কুরিয়ার পার্টনার"), ("বাল্ক", "বুকিং ও ওয়েবিল"), ("রিয়েল-টাইম", "স্ট্যাটাস")],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "fraud": dict(
        badge="ফেইক অর্ডার থেকে সুরক্ষা",
        headline=["ফেইক অর্ডারে আর", "|টাকা ও সময়| নষ্ট না"],
        chips=["রিটার্ন-হিস্ট্রি স্কোর", "কাস্টমার ব্ল্যাকলিস্ট", "OTP ভেরিফিকেশন"],
        stats=[("৫টি", "কুরিয়ার হিস্ট্রি"), ("অটো", "রিস্ক স্কোরিং"), ("OTP", "কনফার্মেশন")],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "payments": dict(
        badge="৭টি পেমেন্ট গেটওয়ে সাপোর্ট",
        headline=["যেভাবেই কাস্টমার পে করুক,", "|আপনি টাকা পাবেন|"],
        chips=["SSLCommerz", "bKash", "Nagad", "AamarPay", "ZiniPay", "ShurjoPay", "EPS"],
        subtext="মার্চেন্ট অ্যাকাউন্ট নেই? পার্সোনাল bKash/Nagad/Rocket নম্বরেও পেমেন্ট নিন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "marketing": dict(
        badge="মার্কেটিং ও কাস্টমার অটোমেশন",
        headline=["একটা মেসেজও যেন", "|মিস| না হয়"],
        chips=["Facebook Pixel + CAPI", "Messenger লিড ইনবক্স", "WhatsApp অটোমেশন", "SMS অটোমেশন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "cta_free": dict(
        badge="কোনো কার্ড ছাড়াই",
        headline=["আজই |ফ্রি| অ্যাকাউন্ট", "খুলুন, বিক্রি শুরু করুন"],
        chips=["৫টি কুরিয়ার", "৭টি পেমেন্ট গেটওয়ে", "ফ্রড প্রোটেকশন"],
        subtext="কার্ড লাগে না, সেটআপ মাত্র ৫ মিনিটে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "trust": dict(
        badge="পেমেন্ট ও ডেলিভারি — দুটোই নিশ্চিত",
        headline=["৫টি কুরিয়ার +", "৭টি |পেমেন্ট গেটওয়ে|"],
        chips=["Pathao", "Steadfast", "RedX", "bKash", "Nagad", "SSLCommerz"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "storefront": dict(
        badge="নিজের অনলাইন শপ, কোনো কোডিং ছাড়াই",
        headline=["নিজের নামে |ফুল ইকমার্স শপ|,", "নিজের সাবডোমেইনে, মিনিটেই"],
        chips=["রেডি থিম", "প্রোডাক্ট ক্যাটালগ", "কার্ট ও চেকআউট", "কাস্টমার রিভিউ"],
        subtext="ডেভেলপার লাগবে না — হোমপেজ, প্রোডাক্ট পেজ, কার্ট সব রেডি করাই আছে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "landing_page": dict(
        badge="ব্লক-বিল্ডার ল্যান্ডিং পেজ",
        headline=["একটা প্রোডাক্টের জন্য", "|হাই-কনভার্টিং| ল্যান্ডিং পেজ"],
        chips=["ড্র্যাগ-ড্রপ বিল্ডার", "OTP ভেরিফাইড চেকআউট", "নিজের সাবডোমেইনে পাবলিশ", "ভিজিট ও অর্ডার অ্যানালিটিক্স"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "hosting": dict(
        badge="কোনো হোস্টিং বা ডোমেইন কেনার দরকার নেই",
        headline=["হোস্টিং, সার্ভার, SSL —", "সব |আমরাই| ম্যানেজ করি"],
        chips=["ফ্রি সাবডোমেইন", "SSL সিকিউরিটি", "৯৯.৯% আপটাইম", "৫ মিনিটে লাইভ"],
        subtext="নিজের ডোমেইন নেই? zyrotechbd.com-এর অধীনে ফ্রি সাবডোমেইন পাবেন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "tracking_problem": dict(
        badge="ফেসবুক পিক্সেল সমস্যা",
        headline=["iOS ১৪+ আপডেটে", "|অনেক অর্ডার| Pixel-এ ধরা পড়ছে না"],
        chips=["Signal Loss", "Ad Blocker", "Safari ITP", "ভুল ক্যাম্পেইন অপ্টিমাইজেশন"],
        subtext="ফলাফল: ভুল ডেটায় বিজ্ঞাপন অপ্টিমাইজ হয়, খরচ বাড়ে, বিক্রি কমে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "tracking_solution": dict(
        badge="সমাধান — Pixel + Conversions API",
        headline=["ব্রাউজার |ও| সার্ভার —", "দুই দিক থেকেই ইভেন্ট পাঠান"],
        chips=["সার্ভার-সাইড CAPI", "অটো ইভেন্ট Dedup", "রিয়েল-টাইম ইভেন্ট লগ", "১ ক্লিকে সেটআপ"],
        subtext="ব্রাউজার মিস করলেও সার্ভার থেকে ইভেন্ট যায় — ম্যাচ কোয়ালিটি বাড়ে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "tracking_why_us": dict(
        badge="কেন আমরাই সেরা",
        headline=["ট্র্যাকিং, স্টোর, কুরিয়ার, পেমেন্ট —", "সব |এক প্ল্যাটফর্মে|"],
        chips=["ডেভেলপার লাগে না", "লাইভ ইভেন্ট কোয়ালিটি মনিটর", "৩০,০০০+ ইভেন্ট/দিন", "হোস্টিং সহ সব একসাথে"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "tracking_pricing": dict(
        badge="যেখানে আলাদা CAPI টুলে মাসিক $20",
        headline=["মাসিক |$20| না —", "|মাত্র ৳৫০০| এ সব ফিচার"],
        chips=["Pixel + CAPI", "৫টি কুরিয়ার", "৭টি পেমেন্ট গেটওয়ে", "স্টোরফ্রন্ট + হোস্টিং"],
        subtext="আলাদা ট্র্যাকিং টুল কিনতে হবে না — সব একসাথে, এক দামে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "accounting": dict(
        badge="অটো-লেজার ও প্রফিট রিপোর্ট",
        headline=["প্রতিটা টাকার হিসাব", "|অটোমেটিক| থাকবে"],
        chips=["অর্ডার-ভিত্তিক অটো-লেজার", "কুরিয়ার চার্জ ট্র্যাকিং", "প্রফিট ও এক্সপেন্স রিপোর্ট"],
        subtext="অর্ডার ডেলিভার হলেই হিসাব আপডেট হয় — ম্যানুয়াল এন্ট্রির ঝামেলা নেই",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "collection_history": dict(
        badge="সব উৎসের কালেকশন এক জায়গায়",
        headline=["কে, কবে, কীভাবে টাকা", "|তুলল| — সব একসাথে"],
        chips=["ম্যানুয়াল কালেকশন", "কুরিয়ার COD", "স্টাফ-ভিত্তিক ফিল্টার", "তারিখ অনুযায়ী সার্চ"],
        subtext="প্রতিটা লেনদেনের রেকর্ড — কে কালেক্ট করেছে জানুন নিশ্চিতভাবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_products": dict(
        badge="ফিজিক্যাল + ডিজিটাল, এক দোকানে",
        headline=["ই-বুক, কোর্স, সফটওয়্যার —", "|ডিজিটাল প্রোডাক্ট|ও বিক্রি করুন"],
        chips=["ইনস্ট্যান্ট ডেলিভারি", "OTP-গেটেড ডাউনলোড লিংক", "ইমেইল/SMS ডেলিভারি"],
        subtext="পেমেন্ট কনফার্ম হলেই কাস্টমার সাথে সাথে লিংক পেয়ে যাবে, কুরিয়ার লাগবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "staff_team": dict(
        badge="মাল্টি-ইউজার টিম ম্যানেজমেন্ট",
        headline=["একা না, |পুরো টিম| নিয়ে", "ব্যবসা চালান"],
        chips=["রোল-ভিত্তিক পারমিশন", "মডিউল-ভিত্তিক অ্যাক্সেস", "স্টাফ অ্যাক্টিভিটি ট্র্যাকিং"],
        subtext="কে কোন মডিউল দেখবে, কে কী করতে পারবে — আপনি ঠিক করবেন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "invoice_pdf": dict(
        badge="অটোমেটিক ইনভয়েস ও ওয়েবিল",
        headline=["প্রতিটা অর্ডারের ইনভয়েস", "|এক ক্লিকেই| রেডি"],
        chips=["PDF ইনভয়েস", "কুরিয়ার ওয়েবিল", "ব্র্যান্ডেড টেমপ্লেট"],
        subtext="সরাসরি প্রিন্ট বা ডাউনলোড করুন, আলাদা কোনো টুল লাগবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "bulk_import": dict(
        badge="মাইগ্রেশন সহজ করতে",
        headline=["হাজার প্রোডাক্ট?", "|এক CSV| আপলোডেই শেষ"],
        chips=["বাল্ক প্রোডাক্ট ইমপোর্ট", "বাল্ক অর্ডার ইমপোর্ট", "ভুল সারি অটো-হাইলাইট"],
        subtext="অন্য জায়গা থেকে সুইচ করছেন? পুরনো ডেটা কয়েক মিনিটেই ইমপোর্ট করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "onboarding": dict(
        badge="নতুন সেলারদের জন্য গাইডেড সেটআপ",
        headline=["প্রথম দিনেই", "|বিভ্রান্ত| হবেন না"],
        chips=["ধাপে ধাপে চেকলিস্ট", "ডেমো ডেটা দিয়ে প্রিভিউ", "প্রতি পেজে হেল্প গাইড"],
        subtext="সাইনআপের পরই স্টেপ-বাই-স্টেপ দেখিয়ে দেবে প্রথমে কী করতে হবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "ai_support": dict(
        badge="AI সাপোর্ট, ২৪/৭ রেডি",
        headline=["সমস্যায় পড়লে,", "|AI সহকারী| সাথে সাথে রেডি"],
        chips=["ইনস্ট্যান্ট ডায়াগনোসিস", "প্রতি পেজে হেল্প বাটন", "না বুঝলে টিম-কে টিকেট"],
        subtext="এজেন্টের জন্য অপেক্ষা না করেই বেশিরভাগ প্রশ্নের উত্তর সাথে সাথে পাবেন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "woocommerce": dict(
        badge="নিজের ওয়েবসাইট থাকলেও চলবে",
        headline=["আপনার |WordPress| সাইট", "সরাসরি কানেক্ট করুন"],
        chips=["WooCommerce কানেক্টর", "অর্ডার সিঙ্ক", "কুরিয়ার ও পেমেন্ট একই ড্যাশবোর্ডে"],
        subtext="নতুন সাইট বানাতে হবে না — বিদ্যমান সাইট থেকেই অর্ডার ম্যানেজ করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "analytics": dict(
        badge="ডেটা দেখে সিদ্ধান্ত নিন",
        headline=["সেলস, কাস্টমার, কুরিয়ার —", "|রিয়েল ডেটা| এক জায়গায়"],
        chips=["সেলস ফানেল ও টপ প্রোডাক্ট", "কাস্টমার ইন্টেলিজেন্স (VIP/রিস্কি)", "কুরিয়ার পারফরম্যান্স রেট"],
        subtext="কোন প্রোডাক্ট, কোন কুরিয়ার, কোন কাস্টমার সবচেয়ে লাভজনক — এক নজরে দেখুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "security_2fa": dict(
        badge="সিকিউরিটি হার্ডেনিং",
        headline=["আপনার অ্যাকাউন্ট", "|সুরক্ষিত| থাকবে সবসময়"],
        chips=["Two-Factor Authentication", "অ্যাডমিন অ্যাক্টিভিটি লগ", "রোল-ভিত্তিক অ্যাক্সেস"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # -----------------------------------------------------------------
    # Digital-product-only seller campaign (added 2026-09-02) — targets
    # sellers who'll use the platform purely for e-book/course/software
    # sales, never a physical product. No courier/waybill mentions here
    # by design — that audience doesn't need it. Grounded in
    # digital_product_context.md / SAAS_MODULE_CONTEXT.md §20 (Phase 1
    # shipped 2026-08-20): hosted-file/external-URL delivery, email/SMS
    # channel, OTP-gated download, COD excluded (wallet+gateway only),
    # mixed cart blocked.
    # -----------------------------------------------------------------
    "digital_master": dict(
        badge="শুধু ডিজিটাল প্রোডাক্ট বিক্রেতাদের জন্য",
        headline=["কুরিয়ার ছাড়াই বিক্রি করুন", "|ই-বুক, কোর্স, সফটওয়্যার|"],
        chips=["ইনস্ট্যান্ট ডেলিভারি", "OTP-গেটেড ডাউনলোড", "ইমেইল/SMS ডেলিভারি", "স্টক-কুরিয়ার লাগে না"],
        subtext="পেমেন্ট কনফার্ম হলেই কাস্টমার সাথে সাথে প্রোডাক্ট পেয়ে যাবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_instant": dict(
        badge="ইনস্ট্যান্ট ডেলিভারি সিস্টেম",
        headline=["পেমেন্ট হলেই", "|সেকেন্ডেই| ডেলিভারি"],
        chips=["অটোমেটেড পেমেন্ট গেটওয়ে", "ইনস্ট্যান্ট ডাউনলোড লিংক", "কোনো ম্যানুয়াল কাজ নেই"],
        subtext="কাস্টমারকে অপেক্ষা করাতে হবে না — পে করার সাথে সাথেই প্রোডাক্ট রেডি",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_security": dict(
        badge="পাইরেসি প্রোটেকশন",
        headline=["লিংক শেয়ার হলেও", "|অন্য কেউ| ডাউনলোড পারবে না"],
        chips=["OTP-ভেরিফাইড ডাউনলোড", "প্রাইভেট ফাইল হোস্টিং", "প্রতি অর্ডারে আলাদা লিংক"],
        subtext="আপনার কনটেন্ট সুরক্ষিত থাকবে, শুধু আসল কাস্টমারই অ্যাক্সেস পাবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_no_inventory": dict(
        badge="কোনো স্টক বা গোডাউন লাগবে না",
        headline=["একবার আপলোড করুন,", "|বারবার| বিক্রি করুন"],
        chips=["কোনো ইনভেন্টরি নেই", "ওয়্যারহাউজ লাগে না", "একই ফাইলে আনলিমিটেড বিক্রি"],
        subtext="ফিজিক্যাল প্রোডাক্টের ঝামেলা ছাড়াই ব্যবসা চালান",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_creators": dict(
        badge="কোর্স ও ই-বুক ক্রিয়েটরদের জন্য",
        headline=["আপনার |কোর্স বা ই-বুক|", "বিক্রি করুন প্রফেশনালি"],
        chips=["নিজের ল্যান্ডিং পেজ", "সিকিউর ডেলিভারি", "কাস্টমার রিভিউ"],
        subtext="আলাদা কোর্স-প্ল্যাটফর্মের কমিশন দিতে হবে না — নিজের দামে, নিজের শপে বিক্রি করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_channels": dict(
        badge="মাল্টি-চ্যানেল অটো-ডেলিভারি",
        headline=["কাস্টমার পাবে", "|ইমেইল বা SMS|-এ, অটোমেটিক"],
        chips=["ইমেইল ডেলিভারি", "SMS ডেলিভারি", "ডাউনলোড লিংক/এক্সটার্নাল URL"],
        subtext="প্রতিটা প্রোডাক্টে আলাদা ডেলিভারি চ্যানেল সেট করতে পারবেন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_payment": dict(
        badge="ইনস্ট্যান্ট পেমেন্ট = ইনস্ট্যান্ট ডেলিভারি",
        headline=["পেমেন্ট কনফার্ম,", "|ডেলিভারিও| একই সেকেন্ডে"],
        chips=["SSLCommerz", "bKash", "Nagad", "পার্সোনাল ওয়ালেট"],
        subtext="ডিজিটাল প্রোডাক্টে COD নেই — পেমেন্ট কনফার্ম হলেই সরাসরি ডেলিভারি ট্রিগার হয়",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_storefront": dict(
        badge="ডিজিটাল প্রোডাক্টের জন্যও ফুল প্ল্যাটফর্ম",
        headline=["স্টোরফ্রন্ট, ট্র্যাকিং —", "|সবই| ডিজিটাল প্রোডাক্টেও"],
        chips=["নিজের সাবডোমেইনে শপ", "Facebook Pixel + CAPI", "সেলস অ্যানালিটিক্স"],
        subtext="ফিজিক্যাল প্রোডাক্টের জন্য যা আছে, ডিজিটাল প্রোডাক্টেও একই সুবিধা পাবেন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "digital_cta": dict(
        badge="কার্ড ছাড়াই, ৫ মিনিটে",
        headline=["আজই |ডিজিটাল প্রোডাক্ট|", "বিক্রি শুরু করুন"],
        chips=["ইনস্ট্যান্ট ডেলিভারি", "OTP-গেটেড ডাউনলোড", "কুরিয়ার লাগে না"],
        subtext="প্রোডাক্ট আপলোড করুন, পেমেন্ট গেটওয়ে কানেক্ট করুন — ব্যস, বিক্রি শুরু",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # -----------------------------------------------------------------
    # Landing-page-builder-only campaign (added 2026-09-02) — targets
    # sellers who run (or want to run) Facebook/Instagram ads and need a
    # dedicated single-product campaign page, not the full storefront.
    # Grounded in landing_page_context.md: block builder (§7-9,18),
    # checkout-time OTP (§10, CheckoutOtpController), per-seller
    # subdomain publish, visit/order analytics
    # (LandingPageAnalyticsController), abandoned-checkout recovery +
    # resume-checkout link + customer-value badge (§19), product
    # variant support (§20).
    # -----------------------------------------------------------------
    "lp_master": dict(
        badge="সিঙ্গেল-প্রোডাক্ট ক্যাম্পেইন পেজ",
        headline=["একটা প্রোডাক্টের জন্য", "|হাই-কনভার্টিং| পেজ বানান"],
        chips=["ব্লক-বিল্ডার", "OTP চেকআউট", "নিজের সাবডোমেইনে পাবলিশ", "ভিজিট-অর্ডার অ্যানালিটিক্স"],
        subtext="বিজ্ঞাপনের ট্রাফিক থেকে সরাসরি অর্ডারে কনভার্ট করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_builder": dict(
        badge="কোনো কোডিং লাগবে না",
        headline=["ড্র্যাগ-ড্রপেই", "|নিজের| ল্যান্ডিং পেজ বানান"],
        chips=["ফিচার গ্রিড ব্লক", "ট্রাস্ট ব্যাজ ব্লক", "মিডিয়া লাইব্রেরি", "থিম/ডিজাইন প্যানেল"],
        subtext="ডেভেলপার ছাড়াই কয়েক মিনিটে প্রফেশনাল পেজ রেডি",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_otp_checkout": dict(
        badge="ফেইক অর্ডার প্রোটেকশন চেকআউটেই",
        headline=["চেকআউটেই", "|OTP| দিয়ে ভেরিফাই"],
        chips=["ফোন OTP ভেরিফিকেশন", "ফেইক অর্ডার ফিল্টার", "রিয়েল কাস্টমার শনাক্ত"],
        subtext="ল্যান্ডিং পেজেই ফেইক অর্ডার আটকে দিন, কুরিয়ারে পাঠানোর আগেই",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_abandoned_cart": dict(
        badge="হারানো সেল ফিরিয়ে আনুন",
        headline=["চেকআউট শেষ না করলেও", "|সেল| হারাবেন না"],
        chips=["অ্যাবানডন্ড চেকআউট ট্র্যাকিং", "রিজিউম-চেকআউট লিংক", "কাস্টমার-ভ্যালু ব্যাজ"],
        subtext="কে অর্ডার অসম্পূর্ণ রেখে গেছে জানুন, এক ক্লিকেই আবার কনভার্ট করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_analytics": dict(
        badge="প্রতিটা ভিজিট ট্র্যাক হয়",
        headline=["কতজন এলো,", "|কতজন| অর্ডার করলো — দেখুন"],
        chips=["ভিজিট অ্যানালিটিক্স", "কনভার্সন রেট", "অর্ডার-টু-ভিজিট রেশিও"],
        subtext="কোন বিজ্ঞাপন কাজ করছে বুঝে বাজেট ঠিক জায়গায় খরচ করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_subdomain": dict(
        badge="নিজের সাবডোমেইনে লাইভ",
        headline=["পেজ বানিয়ে", "|৫ মিনিটেই| লাইভ করুন"],
        chips=["ফ্রি সাবডোমেইন", "SSL সিকিউরিটি", "বিজ্ঞাপনে সরাসরি লিংক দিন"],
        subtext="আলাদা হোস্টিং-ডোমেইন কিনতে হবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_variants": dict(
        badge="সাইজ, কালার — সব অপশন একই পেজে",
        headline=["একই পেজে", "|ভ্যারিয়েন্ট| সিলেক্ট করে অর্ডার"],
        chips=["প্রোডাক্ট ভ্যারিয়েন্ট সাপোর্ট", "সাইজ/কালার সিলেকশন", "স্টক-সঠিক অর্ডার"],
        subtext="কাস্টমার সরাসরি পেজ থেকেই সঠিক ভ্যারিয়েন্ট বেছে অর্ডার করবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_customer_trust": dict(
        badge="নতুন vs পুরাতন কাস্টমার আলাদা করে দেখুন",
        headline=["কে |বিশ্বস্ত| কাস্টমার,", "চেকআউটেই বুঝে যান"],
        chips=["কাস্টমার-ভ্যালু ব্যাজ", "রিটার্নিং কাস্টমার শনাক্ত", "বিনামূল্যে, এক্সটার্নাল API লাগে না"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "lp_cta": dict(
        badge="আজই বানান, আজই পাবলিশ করুন",
        headline=["আপনার প্রথম", "|ল্যান্ডিং পেজ| বানান আজই"],
        chips=["ফ্রি টেমপ্লেট", "৫ মিনিটে লাইভ", "OTP চেকআউট সহ"],
        subtext="সাইনআপ করুন, প্রোডাক্ট যোগ করুন, বিজ্ঞাপন চালান",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # -----------------------------------------------------------------
    # Incomplete order / abandoned checkout recovery campaign (added
    # 2026-09-02) — its own dedicated ad set, deeper than the single
    # `lp_abandoned_cart` angle in the landing-page campaign above.
    # Grounded in landing_page_context.md §19 — scope is landing pages
    # only (not storefront, no `abandoned` mentions in
    # seller_storefront_context.md), and the doc explicitly says
    # automated WhatsApp/SMS/Email recovery-message sending was NOT
    # built (owner decision) — copy here must never claim automated
    # follow-up, only capture/resume-link/dashboard + manual outreach.
    # -----------------------------------------------------------------
    "incomplete_master": dict(
        badge="ইনকমপ্লিট অর্ডার রিকভারি",
        headline=["চেকআউট শেষ না করলেও", "|অর্ডার| হারাবেন না"],
        chips=["অটো-ক্যাপচার", "রিজিউম-চেকআউট লিংক", "কাস্টমার-ভ্যালু ব্যাজ", "CSV এক্সপোর্ট"],
        subtext="কাস্টমার ফর্ম পূরণ করা শুরু করলেই ট্র্যাক হয়ে যায় — সাবমিট না করলেও",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_capture": dict(
        badge="সাবমিট করার আগেই ধরা পড়ে",
        headline=["টাইপ করা শুরু করলেই", "|অটোমেটিক| ক্যাপচার হয়"],
        chips=["নাম/ফোন এন্ট্রি হলেই ট্র্যাক", "কোনো ক্রন জব লাগে না", "ডুপ্লিকেট রো হয় না"],
        subtext="২০ মিনিট অ্যাক্টিভিটি না থাকলে নিজে থেকেই 'অ্যাবানডন্ড' হিসেবে দেখা যায়",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_resume_link": dict(
        badge="এক ক্লিকেই আগের জায়গা থেকে শুরু",
        headline=["রিজিউম লিংক পাঠান,", "|কাস্টমার| আবার ফিরে আসবে"],
        chips=["এক ক্লিকে কপি করুন", "কার্ট ও তথ্য অটো-প্রিফিল", "নতুন করে টাইপ লাগবে না"],
        subtext="আগে যা যা লিখেছিল, ফিরে এসে সবকিছু আগের মতোই পাবে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_customer_value": dict(
        badge="কে আগের কাস্টমার, সাথে সাথে দেখুন",
        headline=["এই লিড কি আগে থেকেই", "|কাস্টমার|? এক নজরে জানুন"],
        chips=["মোট অর্ডার ও খরচের হিস্ট্রি", "রিস্ক লেভেল", "বিনামূল্যে, এক্সটার্নাল API লাগে না"],
        subtext="কাকে আগে ফলোআপ করবেন বুঝে অগ্রাধিকার ঠিক করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_dashboard": dict(
        badge="সব অসম্পূর্ণ অর্ডার এক জায়গায়",
        headline=["প্রতিটা অসম্পূর্ণ অর্ডার", "|এক ড্যাশবোর্ডে| ম্যানেজ করুন"],
        chips=["ফিল্টার ও সার্চ", "CSV এক্সপোর্ট", "ডিসমিস বা ডিলিট"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_manual_followup": dict(
        badge="নিজের চ্যানেলেই ফলোআপ করুন",
        headline=["রিজিউম লিংক কপি করে", "|WhatsApp বা কলে| পাঠান"],
        chips=["এক ক্লিকে লিংক কপি", "নিজের নম্বর থেকেই মেসেজ", "থার্ড-পার্টি টুল লাগে না"],
        subtext="আপনি যেভাবে কাস্টমারের সাথে কথা বলেন, ঠিক সেভাবেই ফলোআপ করুন",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_convert": dict(
        badge="ফলোআপের ফলাফলও ট্র্যাক হয়",
        headline=["রিয়েল অর্ডারে কনভার্ট হলে", "|অটোমেটিক| আপডেট হয়"],
        chips=["অর্ডারের সাথে অটো-লিংক", "কনভার্সন স্ট্যাটাস", "ফলোআপ কাজ করছে কিনা বুঝুন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "incomplete_cta": dict(
        badge="আজই চালু করুন",
        headline=["হারানো অর্ডার", "|ফিরিয়ে আনা| শুরু করুন আজই"],
        chips=["ল্যান্ডিং পেজেই বিল্ট-ইন", "সেটআপ লাগে না", "সাইনআপের সাথেই রেডি"],
        subtext="নতুন কিছু চালু করতে হবে না — ল্যান্ডিং পেজ থাকলেই কাজ করে",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # ===================================================================
    # Per-module deep-dive campaigns (added 2026-09-02) — "standard" depth
    # (user-selected: 3-4 angles per module, fewer for genuinely thin
    # modules rather than padding). Each module keeps its original single
    # generic theme (courier/fraud/payments/marketing/storefront/hosting/
    # accounting/collection_history/staff_team/invoice_pdf/bulk_import/
    # onboarding/ai_support/woocommerce/analytics/security_2fa above) and
    # gets new theme keys below for the additional angles — no existing
    # key is touched. Messenger lead-capture is deliberately NOT one of
    # the marketing angles: pages_messaging is still rejected in App
    # Review (facebook_integration_context.md §10) so it doesn't actually
    # work yet for a new seller who isn't admin/dev/tester on the Meta
    # app — same caution already applied to WhatsApp/auto-top-up.
    # ===================================================================

    # --- Courier (3) ---
    "courier_waybill": dict(
        badge="ব্র্যান্ডেড ওয়েবিল ও স্টিকার",
        headline=["প্রতিটা অর্ডারের", "|ওয়েবিল/লেবেল| এক ক্লিকে"],
        chips=["২২টা স্টিকার টেমপ্লেট", "Pathao-স্টাইল লেবেল", "সরাসরি প্রিন্ট"],
        subtext="সেলার-সিলেক্টেবল ডিজাইন, প্রিভিউ থাম্বনেইল সহ",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "courier_realtime": dict(
        badge="রিয়েল-টাইম স্ট্যাটাস সিঙ্ক",
        headline=["কুরিয়ারের প্যানেলে", "|বারবার| চেক করতে হবে না"],
        chips=["অটো স্ট্যাটাস আপডেট", "৫টা কুরিয়ার একসাথে", "অর্ডার টাইমলাইনে লগ"],
        subtext="ডেলিভারি হলো কিনা জানতে আলাদা করে কুরিয়ার সাইটে যেতে হবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "courier_bulk": dict(
        badge="একসাথে অনেক অর্ডার বুকিং",
        headline=["একটা একটা করে না,", "|বাল্ক বুকিং| করুন"],
        chips=["মাল্টি-অর্ডার সিলেক্ট", "এক ক্লিকে সব বুক", "সময় বাঁচান"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Fraud (3) ---
    "fraud_return_history": dict(
        badge="৫টা কুরিয়ারের রিটার্ন-হিস্ট্রি একসাথে",
        headline=["এই কাস্টমার আগে কতবার", "|রিটার্ন| করেছে? জানুন আগেই"],
        chips=["অ্যাগ্রিগেটেড রিটার্ন স্কোর", "৫টা কুরিয়ারের ডেটা", "অটো রিস্ক ক্যালকুলেশন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "fraud_blacklist": dict(
        badge="বারবার সমস্যা করা কাস্টমার আটকান",
        headline=["একবার ব্ল্যাকলিস্ট করুন,", "|বারবার| ফেইক অর্ডার বন্ধ"],
        chips=["কাস্টমার ব্ল্যাকলিস্ট", "অটো-ফ্ল্যাগ রিপিট অ্যাবিউজার", "শপ-ওয়াইড প্রোটেকশন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "fraud_otp": dict(
        badge="চেকআউটেই ভেরিফিকেশন",
        headline=["OTP দিয়ে", "|রিয়েল কাস্টমার| শনাক্ত করুন"],
        chips=["ফোন OTP ভেরিফিকেশন", "কুরিয়ারে পাঠানোর আগেই ফিল্টার", "কম রিটার্ন, কম খরচ"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Payments (3) ---
    "payments_gateways": dict(
        badge="৭টা অটোমেটেড গেটওয়ে",
        headline=["SSLCommerz, bKash, Nagad —", "|৭টা গেটওয়েই| রেডি"],
        chips=["SSLCommerz", "bKash Merchant", "Nagad Merchant", "AamarPay/ZiniPay/ShurjoPay/EPS"],
        subtext="ইনস্ট্যান্ট অটো-ভেরিফাই, ম্যানুয়াল TrxID রিভিউ করতে হবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "payments_wallet": dict(
        badge="মার্চেন্ট অ্যাকাউন্ট নেই? সমস্যা নেই",
        headline=["পার্সোনাল bKash/Nagad নম্বরেও", "|পেমেন্ট| নিতে পারবেন"],
        chips=["পার্সোনাল ওয়ালেট সাপোর্ট", "স্ক্রিনশট ভেরিফাই", "কোনো মার্চেন্ট রেজিস্ট্রেশন লাগে না"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "payments_choice": dict(
        badge="কাস্টমারের পছন্দ, আপনার সুবিধা",
        headline=["কাস্টমার |যেভাবেই| পে করুক,", "আপনি টাকা পাবেন"],
        chips=["মাল্টি-গেটওয়ে চেকআউট", "COD-ও সাপোর্টেড", "একই ড্যাশবোর্ডে সব পেমেন্ট"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Marketing (2 — Messenger deliberately excluded, App Review pending) ---
    "marketing_sms": dict(
        badge="অর্ডার স্ট্যাটাসে অটো SMS",
        headline=["অর্ডার কনফার্ম থেকে ডেলিভারি —", "|প্রতিটা ধাপে| অটো SMS"],
        chips=["স্ট্যাটাস-ট্রিগারড অটোমেশন", "মাল্টি-গেটওয়ে SMS", "ক্রেডিট সিস্টেম সহ"],
        subtext="কাস্টমারকে ম্যানুয়ালি মেসেজ করতে হবে না",
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "marketing_notification": dict(
        badge="SMS + ইমেইল, এক জায়গা থেকে",
        headline=["সব নোটিফিকেশন টেমপ্লেট", "|এক জায়গায়| ম্যানেজ করুন"],
        chips=["SMS টেমপ্লেট", "ইমেইল টেমপ্লেট", "ইউজ-কেস অনুযায়ী বাইন্ডিং"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Storefront (3) ---
    "storefront_themes": dict(
        badge="রেডি থিম, নিজের মতো সাজান",
        headline=["পছন্দের |থিম| বেছে নিন,", "নিজের শপ সাজান"],
        chips=["Standard টেমপ্লেট", "CareSolution টেমপ্লেট", "কালার/ব্র্যান্ডিং কাস্টমাইজ"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "storefront_reviews": dict(
        badge="কাস্টমার রিভিউ = বিশ্বাস",
        headline=["প্রোডাক্ট পেজেই", "|কাস্টমার রিভিউ| দেখান"],
        chips=["বিল্ট-ইন রিভিউ সিস্টেম", "নতুন কাস্টমারের আস্থা বাড়ায়", "কোনো এক্সটার্নাল প্লাগইন লাগে না"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "storefront_seo": dict(
        badge="গুগলেও খুঁজে পাওয়া যাবে",
        headline=["শুধু বিজ্ঞাপন না,", "|গুগল সার্চেও| দেখা যাবে"],
        chips=["SEO-রেডি পেজ", "sitemap ও OG ট্যাগ", "স্ট্রাকচার্ড ডেটা"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Hosting (2 — thin module, kept honest) ---
    "hosting_speed": dict(
        badge="আজই শুরু করুন",
        headline=["সাইনআপ থেকে লাইভ শপ —", "|৫ মিনিটেই|"],
        chips=["কোনো টেকনিক্যাল সেটআপ নেই", "ফ্রি সাবডোমেইন", "তাৎক্ষণিক অ্যাক্সেস"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "hosting_ssl": dict(
        badge="সিকিউরিটি বিল্ট-ইন",
        headline=["SSL, আপটাইম, সার্ভার —", "|সব| আমরাই সামলাই"],
        chips=["ফ্রি SSL সার্টিফিকেট", "৯৯.৯% আপটাইম", "কোনো এক্সট্রা খরচ নেই"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Accounting (3) ---
    "accounting_ledger": dict(
        badge="অর্ডার হলেই হিসাব লেখা হয়",
        headline=["অর্ডার কনফার্ম বা ডেলিভারি —", "|লেজার| অটো আপডেট"],
        chips=["অর্ডার-ট্রিগারড এন্ট্রি", "ম্যানুয়াল টাইপ করতে হয় না", "রিয়েল-টাইম হিসাব"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "accounting_courier_charge": dict(
        badge="কুরিয়ার চার্জও হিসাবে থাকে",
        headline=["ডেলিভারি চার্জ", "|আলাদা করে| ট্র্যাক করতে হবে না"],
        chips=["অটো এক্সপেন্স এন্ট্রি", "কুরিয়ার-ভিত্তিক ব্রেকডাউন", "আসল প্রফিট বুঝুন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "accounting_reports": dict(
        badge="সামারি, এক্সপেন্স, প্রফিট",
        headline=["মাস শেষে |প্রফিট| কত,", "রিপোর্টেই দেখুন"],
        chips=["সামারি রিপোর্ট", "এক্সপেন্স ব্রেকডাউন", "প্রফিট ক্যালকুলেশন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Collection history (2) ---
    "collection_sources": dict(
        badge="ম্যানুয়াল + কুরিয়ার COD, এক জায়গায়",
        headline=["সব উৎসের কালেকশন", "|এক লিস্টে| দেখুন"],
        chips=["ম্যানুয়াল কালেকশন", "কুরিয়ার COD", "ইউনিফাইড টাইমলাইন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "collection_staff_filter": dict(
        badge="কে কালেক্ট করলো, জানুন",
        headline=["স্টাফ ও তারিখ দিয়ে", "|ফিল্টার| করে খুঁজুন"],
        chips=["স্টাফ-ভিত্তিক ফিল্টার", "তারিখ রেঞ্জ", "অর্ডার নম্বর সার্চ"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Staff/team (3) ---
    "staff_roles": dict(
        badge="রোল-ভিত্তিক অ্যাক্সেস",
        headline=["কে কোন মডিউল দেখবে,", "|আপনি| ঠিক করবেন"],
        chips=["মডিউল-ভিত্তিক পারমিশন", "একাধিক স্টাফ অ্যাকাউন্ট", "কাস্টমাইজেবল রোল"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "staff_owner_control": dict(
        badge="সংবেদনশীল সেটিংস শুধু আপনার হাতে",
        headline=["কুরিয়ার-পেমেন্ট সেটিংস", "|শুধু| আপনি পাল্টাবেন"],
        chips=["ওনার-অনলি সেটিংস", "স্টাফ কখনো টাচ করতে পারবে না", "নিয়ন্ত্রণ থাকবে আপনার হাতেই"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "staff_tracking": dict(
        badge="স্টাফ পারফরম্যান্স দেখুন",
        headline=["কোন স্টাফ কী করলো,", "|ট্র্যাক| থাকবে"],
        chips=["অ্যাক্টিভিটি ভিজিবিলিটি", "দায়িত্ব বণ্টন সহজ", "টিম বড় হলেও নিয়ন্ত্রণ থাকবে"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Invoice/PDF (2) ---
    "invoice_branded": dict(
        badge="নিজের ব্র্যান্ডে ইনভয়েস",
        headline=["প্রতিটা অর্ডারের", "|ব্র্যান্ডেড ইনভয়েস| রেডি"],
        chips=["PDF ইনভয়েস", "নিজের শপের নাম/লোগো", "কাস্টমারকে দিন সরাসরি"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "invoice_instant": dict(
        badge="ম্যানুয়ালি বানাতে হবে না",
        headline=["এক ক্লিকে", "|জেনারেট, প্রিন্ট, ডাউনলোড|"],
        chips=["ইনস্ট্যান্ট জেনারেশন", "ওয়ার্ড/এক্সেলে বানানো লাগবে না", "প্রতিটা অর্ডারে রেডি"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Bulk import (3) ---
    "bulk_products": dict(
        badge="হাজার প্রোডাক্ট এক CSV-তে",
        headline=["প্রোডাক্ট একটা একটা", "|টাইপ| করতে হবে না"],
        chips=["CSV প্রোডাক্ট ইমপোর্ট", "টেমপ্লেট ডাউনলোড", "বাল্কে ক্যাটালগ রেডি"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "bulk_orders": dict(
        badge="অন্য প্ল্যাটফর্ম থেকে সুইচ করছেন?",
        headline=["পুরনো অর্ডার ডেটা", "|কয়েক মিনিটেই| ইমপোর্ট"],
        chips=["CSV অর্ডার ইমপোর্ট", "মাইগ্রেশন সহজ", "একসাথে অনেক অর্ডার"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "bulk_validation": dict(
        badge="ভুল ডেটা আগেই ধরা পড়ে",
        headline=["কমিট করার আগেই", "|ভুল সারি| হাইলাইট হয়"],
        chips=["প্রিভিউ-তে ভ্যালিডেশন", "শুধু সঠিক সারি সেভ হয়", "কোনো করাপ্টেড ডেটা ঢোকে না"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Onboarding (3) ---
    "onboarding_checklist": dict(
        badge="ধাপে ধাপে গাইড",
        headline=["কী করতে হবে,", "|চেকলিস্টই| বলে দেবে"],
        chips=["প্রোফাইল-প্রোডাক্ট-কুরিয়ার-পেমেন্ট", "লাইভ ডেটা থেকে ধাপ", "ডিসমিসেবল"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "onboarding_demo": dict(
        badge="খালি ড্যাশবোর্ডে আটকাবেন না",
        headline=["ডেমো ডেটা দিয়ে", "|আগেই| প্রিভিউ দেখুন"],
        chips=["৩টা ডেমো প্রোডাক্ট", "লাইভ শপে কখনো দেখাবে না", "ফিচার বুঝে তারপর শুরু করুন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "onboarding_help": dict(
        badge="প্রতি পেজেই সাহায্য",
        headline=["কোথাও আটকে গেলে,", "|হেল্প গাইড| রেডি"],
        chips=["প্রতি পেজে গাইড", "একা লাগবে না", "নতুন সেলারদের জন্য বিশেষভাবে বানানো"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- AI support (3) ---
    "ai_diagnosis": dict(
        badge="\"কেন কাজ করছে না\" — তাৎক্ষণিক উত্তর",
        headline=["সমস্যার |কারণ|", "সাথে সাথেই বলে দেবে"],
        chips=["রিয়েল অ্যাকাউন্ট ডেটা দেখে ডায়াগনোসিস", "SMS/পেমেন্ট/অর্ডার ইস্যু", "এজেন্টের জন্য অপেক্ষা নেই"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "ai_helpbutton": dict(
        badge="প্রতি পেজে হেল্প বাটন",
        headline=["\"এটা কীভাবে ব্যবহার করব?\"", "|এক ক্লিকেই| উত্তর"],
        chips=["পেজ-স্পেসিফিক গাইড", "কোনো ডকুমেন্টেশন খুঁজতে হবে না", "সব ড্যাশবোর্ড পেজেই আছে"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "ai_escalation": dict(
        badge="বুঝে-শুনে টিমে পাঠায়",
        headline=["না বুঝলে চুপচাপ না,", "|জিজ্ঞেস| করে টিকেট খোলে"],
        chips=["জরুরি হলে সরাসরি এসকেলেট", "সাধারণ প্রশ্নে আগে জিজ্ঞেস করে", "পুরো চ্যাট-ইতিহাস টিকেটে যোগ হয়"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- WooCommerce (3) ---
    "woo_sync": dict(
        badge="দুই দিকেই সিঙ্ক হয়",
        headline=["WordPress আর BSOL —", "|প্রোডাক্ট/অর্ডার| সবসময় মিলবে"],
        chips=["টু-ওয়ে সিঙ্ক", "রিয়েল-টাইম আপডেট", "ম্যানুয়াল মেলাতে হবে না"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "woo_courier_payment": dict(
        badge="একই ইঞ্জিন, নিজের সাইটেও",
        headline=["WooCommerce অর্ডারেও", "|৫টা কুরিয়ার| বুক করুন"],
        chips=["একই কুরিয়ার ইঞ্জিন", "একই পেমেন্ট গেটওয়ে", "একই ড্যাশবোর্ড থেকে ম্যানেজ"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "woo_extra": dict(
        badge="ফ্রড ও ট্র্যাকিংও পোর্ট হয়ে যায়",
        headline=["OTP চেকআউট, ফ্রড প্রোটেকশন,", "Pixel — |সবই| ওয়ার্ডপ্রেসে"],
        chips=["চেকআউট OTP", "ফ্রড ফিল্টার", "Facebook CAPI"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Analytics (3) ---
    "analytics_sales": dict(
        badge="সেলস ফানেল রিয়েল ডেটায়",
        headline=["কোন প্রোডাক্ট", "|সবচেয়ে বেশি| বিক্রি হচ্ছে"],
        chips=["সেলস ফানেল", "টপ প্রোডাক্ট", "ডেইলি ট্রেন্ড"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "analytics_customer": dict(
        badge="কাস্টমার ইন্টেলিজেন্স",
        headline=["কে VIP, কে |রিস্কি|", "কাস্টমার — আলাদা করে দেখুন"],
        chips=["লয়াল/VIP/রিস্কি সেগমেন্ট", "রিপিট-বায়ার রেট", "এলাকা-ভিত্তিক ব্রেকডাউন"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "analytics_courier": dict(
        badge="কুরিয়ার-ভিত্তিক পারফরম্যান্স",
        headline=["কোন কুরিয়ারে", "|সাকসেস রেট| সবচেয়ে ভালো"],
        chips=["সাকসেস/রিটার্ন রেট", "গড় ডেলিভারি সময়", "চার্জ তুলনা"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),

    # --- Security (2) ---
    "security_totp": dict(
        badge="TOTP 2FA, RFC 6238",
        headline=["পাসওয়ার্ড ছাড়াও", "|দ্বিতীয় স্তরের| সুরক্ষা"],
        chips=["Authenticator App সাপোর্ট", "রিকভারি কোড", "লগইন চ্যালেঞ্জ ফ্লো"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
    "security_audit": dict(
        badge="কে কী পরিবর্তন করলো",
        headline=["গুরুত্বপূর্ণ অ্যাডমিন অ্যাকশনের", "|অডিট লগ| থাকবে"],
        chips=["ইউজার/প্যাকেজ পরিবর্তন লগ", "পেমেন্ট অ্যাপ্রুভাল লগ", "স্কেল বাড়লেও জবাবদিহিতা"],
        cta="ফ্রি অ্যাকাউন্ট খুলুন →",
    ),
}

# ---------------------------------------------------------------------------
# Manifest: (filename, width, height, theme_key, style, layout)
# ---------------------------------------------------------------------------
MANIFEST = [
    # Landscape 1200x630 — Facebook feed link/image ad, per feature
    ("landscape-courier-dark",   1200, 630, "courier",   "dark", "landscape"),
    ("landscape-fraud-dark",     1200, 630, "fraud",     "dark", "landscape"),
    ("landscape-payments-dark",  1200, 630, "payments",  "dark", "landscape"),
    ("landscape-marketing-dark", 1200, 630, "marketing", "dark", "landscape"),
    ("landscape-storefront-dark",   1200, 630, "storefront",   "dark", "landscape"),
    ("landscape-landingpage-dark",  1200, 630, "landing_page", "dark", "landscape"),
    ("landscape-hosting-dark",      1200, 630, "hosting",      "dark", "landscape"),
    ("landscape-tracking-problem-dark",  1200, 630, "tracking_problem",  "dark", "landscape"),
    ("landscape-tracking-solution-dark", 1200, 630, "tracking_solution", "dark", "landscape"),
    ("landscape-tracking-whyus-dark",    1200, 630, "tracking_why_us",   "dark", "landscape"),
    ("landscape-tracking-pricing-dark",  1200, 630, "tracking_pricing",  "dark", "landscape"),
    ("landscape-accounting-dark",         1200, 630, "accounting",         "dark", "landscape"),
    ("landscape-collection-history-dark", 1200, 630, "collection_history", "dark", "landscape"),
    ("landscape-digital-products-dark",   1200, 630, "digital_products",   "dark", "landscape"),
    ("landscape-staff-team-dark",         1200, 630, "staff_team",         "dark", "landscape"),
    ("landscape-invoice-pdf-dark",        1200, 630, "invoice_pdf",        "dark", "landscape"),
    ("landscape-bulk-import-dark",        1200, 630, "bulk_import",        "dark", "landscape"),
    ("landscape-onboarding-dark",         1200, 630, "onboarding",         "dark", "landscape"),
    ("landscape-ai-support-dark",         1200, 630, "ai_support",         "dark", "landscape"),
    ("landscape-woocommerce-dark",        1200, 630, "woocommerce",        "dark", "landscape"),
    ("landscape-analytics-dark",          1200, 630, "analytics",          "dark", "landscape"),
    ("landscape-security-dark",           1200, 630, "security_2fa",       "dark", "landscape"),

    # Digital-product-only seller campaign (landscape)
    ("landscape-digital-master-dark",       1200, 630, "digital_master",       "dark", "landscape"),
    ("landscape-digital-instant-dark",      1200, 630, "digital_instant",      "dark", "landscape"),
    ("landscape-digital-security-dark",     1200, 630, "digital_security",     "dark", "landscape"),
    ("landscape-digital-no-inventory-dark", 1200, 630, "digital_no_inventory", "dark", "landscape"),
    ("landscape-digital-creators-dark",     1200, 630, "digital_creators",     "dark", "landscape"),
    ("landscape-digital-channels-dark",     1200, 630, "digital_channels",     "dark", "landscape"),
    ("landscape-digital-payment-dark",      1200, 630, "digital_payment",      "dark", "landscape"),
    ("landscape-digital-storefront-dark",   1200, 630, "digital_storefront",   "dark", "landscape"),
    ("landscape-digital-cta-dark",          1200, 630, "digital_cta",          "dark", "landscape"),

    # Landing-page-builder-only campaign (landscape)
    ("landscape-lp-master-dark",          1200, 630, "lp_master",          "dark", "landscape"),
    ("landscape-lp-builder-dark",         1200, 630, "lp_builder",         "dark", "landscape"),
    ("landscape-lp-otp-checkout-dark",    1200, 630, "lp_otp_checkout",    "dark", "landscape"),
    ("landscape-lp-abandoned-cart-dark",  1200, 630, "lp_abandoned_cart",  "dark", "landscape"),
    ("landscape-lp-analytics-dark",       1200, 630, "lp_analytics",       "dark", "landscape"),
    ("landscape-lp-subdomain-dark",       1200, 630, "lp_subdomain",       "dark", "landscape"),
    ("landscape-lp-variants-dark",        1200, 630, "lp_variants",        "dark", "landscape"),
    ("landscape-lp-customer-trust-dark",  1200, 630, "lp_customer_trust",  "dark", "landscape"),
    ("landscape-lp-cta-dark",             1200, 630, "lp_cta",             "dark", "landscape"),

    # Incomplete order / abandoned checkout recovery campaign (landscape)
    ("landscape-incomplete-master-dark",          1200, 630, "incomplete_master",          "dark", "landscape"),
    ("landscape-incomplete-capture-dark",         1200, 630, "incomplete_capture",         "dark", "landscape"),
    ("landscape-incomplete-resume-link-dark",     1200, 630, "incomplete_resume_link",     "dark", "landscape"),
    ("landscape-incomplete-customer-value-dark",  1200, 630, "incomplete_customer_value",  "dark", "landscape"),
    ("landscape-incomplete-dashboard-dark",       1200, 630, "incomplete_dashboard",       "dark", "landscape"),
    ("landscape-incomplete-manual-followup-dark", 1200, 630, "incomplete_manual_followup", "dark", "landscape"),
    ("landscape-incomplete-convert-dark",         1200, 630, "incomplete_convert",         "dark", "landscape"),
    ("landscape-incomplete-cta-dark",             1200, 630, "incomplete_cta",             "dark", "landscape"),

    # Per-module deep-dive campaigns (landscape) — standard depth (2026-09-02)
    ("landscape-courier-waybill-dark",          1200, 630, "courier_waybill",          "dark", "landscape"),
    ("landscape-courier-realtime-dark",         1200, 630, "courier_realtime",         "dark", "landscape"),
    ("landscape-courier-bulk-dark",             1200, 630, "courier_bulk",             "dark", "landscape"),
    ("landscape-fraud-return-history-dark",     1200, 630, "fraud_return_history",     "dark", "landscape"),
    ("landscape-fraud-blacklist-dark",          1200, 630, "fraud_blacklist",          "dark", "landscape"),
    ("landscape-fraud-otp-dark",                1200, 630, "fraud_otp",                "dark", "landscape"),
    ("landscape-payments-gateways-dark",        1200, 630, "payments_gateways",        "dark", "landscape"),
    ("landscape-payments-wallet-dark",          1200, 630, "payments_wallet",          "dark", "landscape"),
    ("landscape-payments-choice-dark",          1200, 630, "payments_choice",          "dark", "landscape"),
    ("landscape-marketing-sms-dark",            1200, 630, "marketing_sms",            "dark", "landscape"),
    ("landscape-marketing-notification-dark",   1200, 630, "marketing_notification",   "dark", "landscape"),
    ("landscape-storefront-themes-dark",        1200, 630, "storefront_themes",        "dark", "landscape"),
    ("landscape-storefront-reviews-dark",       1200, 630, "storefront_reviews",       "dark", "landscape"),
    ("landscape-storefront-seo-dark",           1200, 630, "storefront_seo",           "dark", "landscape"),
    ("landscape-hosting-speed-dark",            1200, 630, "hosting_speed",            "dark", "landscape"),
    ("landscape-hosting-ssl-dark",              1200, 630, "hosting_ssl",              "dark", "landscape"),
    ("landscape-accounting-ledger-dark",        1200, 630, "accounting_ledger",        "dark", "landscape"),
    ("landscape-accounting-courier-charge-dark",1200, 630, "accounting_courier_charge","dark", "landscape"),
    ("landscape-accounting-reports-dark",       1200, 630, "accounting_reports",       "dark", "landscape"),
    ("landscape-collection-sources-dark",       1200, 630, "collection_sources",       "dark", "landscape"),
    ("landscape-collection-staff-filter-dark",  1200, 630, "collection_staff_filter",  "dark", "landscape"),
    ("landscape-staff-roles-dark",              1200, 630, "staff_roles",              "dark", "landscape"),
    ("landscape-staff-owner-control-dark",      1200, 630, "staff_owner_control",      "dark", "landscape"),
    ("landscape-staff-tracking-dark",           1200, 630, "staff_tracking",           "dark", "landscape"),
    ("landscape-invoice-branded-dark",          1200, 630, "invoice_branded",          "dark", "landscape"),
    ("landscape-invoice-instant-dark",          1200, 630, "invoice_instant",          "dark", "landscape"),
    ("landscape-bulk-products-dark",            1200, 630, "bulk_products",            "dark", "landscape"),
    ("landscape-bulk-orders-dark",              1200, 630, "bulk_orders",              "dark", "landscape"),
    ("landscape-bulk-validation-dark",          1200, 630, "bulk_validation",          "dark", "landscape"),
    ("landscape-onboarding-checklist-dark",     1200, 630, "onboarding_checklist",     "dark", "landscape"),
    ("landscape-onboarding-demo-dark",          1200, 630, "onboarding_demo",          "dark", "landscape"),
    ("landscape-onboarding-help-dark",          1200, 630, "onboarding_help",          "dark", "landscape"),
    ("landscape-ai-diagnosis-dark",             1200, 630, "ai_diagnosis",             "dark", "landscape"),
    ("landscape-ai-helpbutton-dark",            1200, 630, "ai_helpbutton",            "dark", "landscape"),
    ("landscape-ai-escalation-dark",            1200, 630, "ai_escalation",            "dark", "landscape"),
    ("landscape-woo-sync-dark",                 1200, 630, "woo_sync",                 "dark", "landscape"),
    ("landscape-woo-courier-payment-dark",      1200, 630, "woo_courier_payment",      "dark", "landscape"),
    ("landscape-woo-extra-dark",                1200, 630, "woo_extra",                "dark", "landscape"),
    ("landscape-analytics-sales-dark",          1200, 630, "analytics_sales",          "dark", "landscape"),
    ("landscape-analytics-customer-dark",       1200, 630, "analytics_customer",       "dark", "landscape"),
    ("landscape-analytics-courier-dark",        1200, 630, "analytics_courier",        "dark", "landscape"),
    ("landscape-security-totp-dark",            1200, 630, "security_totp",            "dark", "landscape"),
    ("landscape-security-audit-dark",           1200, 630, "security_audit",           "dark", "landscape"),

    # Square 1080x1080 — Facebook/Instagram feed
    ("square-master-dark",  1080, 1080, "master",   "dark",  "stack"),
    ("square-master-light", 1080, 1080, "master",   "light", "stack"),
    ("square-cta-dark",     1080, 1080, "cta_free", "dark",  "stack"),
    ("square-storefront-dark",   1080, 1080, "storefront",   "dark", "stack"),
    ("square-landingpage-dark",  1080, 1080, "landing_page", "dark", "stack"),
    ("square-hosting-dark",      1080, 1080, "hosting",      "dark", "stack"),
    ("square-tracking-problem-dark",  1080, 1080, "tracking_problem",  "dark", "stack"),
    ("square-tracking-solution-dark", 1080, 1080, "tracking_solution", "dark", "stack"),
    ("square-tracking-whyus-dark",    1080, 1080, "tracking_why_us",   "dark", "stack"),
    ("square-tracking-pricing-dark",  1080, 1080, "tracking_pricing",  "dark", "stack"),
    ("square-accounting-dark",         1080, 1080, "accounting",         "dark", "stack"),
    ("square-collection-history-dark", 1080, 1080, "collection_history", "dark", "stack"),
    ("square-digital-products-dark",   1080, 1080, "digital_products",   "dark", "stack"),
    ("square-staff-team-dark",         1080, 1080, "staff_team",         "dark", "stack"),
    ("square-invoice-pdf-dark",        1080, 1080, "invoice_pdf",        "dark", "stack"),
    ("square-bulk-import-dark",        1080, 1080, "bulk_import",        "dark", "stack"),
    ("square-onboarding-dark",         1080, 1080, "onboarding",         "dark", "stack"),
    ("square-ai-support-dark",         1080, 1080, "ai_support",         "dark", "stack"),
    ("square-woocommerce-dark",        1080, 1080, "woocommerce",        "dark", "stack"),
    ("square-analytics-dark",          1080, 1080, "analytics",          "dark", "stack"),
    ("square-security-dark",           1080, 1080, "security_2fa",       "dark", "stack"),

    # Digital-product-only seller campaign (square)
    ("square-digital-master-dark",       1080, 1080, "digital_master",       "dark", "stack"),
    ("square-digital-instant-dark",      1080, 1080, "digital_instant",      "dark", "stack"),
    ("square-digital-security-dark",     1080, 1080, "digital_security",     "dark", "stack"),
    ("square-digital-no-inventory-dark", 1080, 1080, "digital_no_inventory", "dark", "stack"),
    ("square-digital-creators-dark",     1080, 1080, "digital_creators",     "dark", "stack"),
    ("square-digital-channels-dark",     1080, 1080, "digital_channels",     "dark", "stack"),
    ("square-digital-payment-dark",      1080, 1080, "digital_payment",      "dark", "stack"),
    ("square-digital-storefront-dark",   1080, 1080, "digital_storefront",   "dark", "stack"),
    ("square-digital-cta-dark",          1080, 1080, "digital_cta",          "dark", "stack"),

    # Landing-page-builder-only campaign (square)
    ("square-lp-master-dark",          1080, 1080, "lp_master",          "dark", "stack"),
    ("square-lp-builder-dark",         1080, 1080, "lp_builder",         "dark", "stack"),
    ("square-lp-otp-checkout-dark",    1080, 1080, "lp_otp_checkout",    "dark", "stack"),
    ("square-lp-abandoned-cart-dark",  1080, 1080, "lp_abandoned_cart",  "dark", "stack"),
    ("square-lp-analytics-dark",       1080, 1080, "lp_analytics",       "dark", "stack"),
    ("square-lp-subdomain-dark",       1080, 1080, "lp_subdomain",       "dark", "stack"),
    ("square-lp-variants-dark",        1080, 1080, "lp_variants",        "dark", "stack"),
    ("square-lp-customer-trust-dark",  1080, 1080, "lp_customer_trust",  "dark", "stack"),
    ("square-lp-cta-dark",             1080, 1080, "lp_cta",             "dark", "stack"),

    # Incomplete order / abandoned checkout recovery campaign (square)
    ("square-incomplete-master-dark",          1080, 1080, "incomplete_master",          "dark", "stack"),
    ("square-incomplete-capture-dark",         1080, 1080, "incomplete_capture",         "dark", "stack"),
    ("square-incomplete-resume-link-dark",     1080, 1080, "incomplete_resume_link",     "dark", "stack"),
    ("square-incomplete-customer-value-dark",  1080, 1080, "incomplete_customer_value",  "dark", "stack"),
    ("square-incomplete-dashboard-dark",       1080, 1080, "incomplete_dashboard",       "dark", "stack"),
    ("square-incomplete-manual-followup-dark", 1080, 1080, "incomplete_manual_followup", "dark", "stack"),
    ("square-incomplete-convert-dark",         1080, 1080, "incomplete_convert",         "dark", "stack"),
    ("square-incomplete-cta-dark",             1080, 1080, "incomplete_cta",             "dark", "stack"),

    # Per-module deep-dive campaigns (square) — standard depth (2026-09-02)
    ("square-courier-waybill-dark",          1080, 1080, "courier_waybill",          "dark", "stack"),
    ("square-courier-realtime-dark",         1080, 1080, "courier_realtime",         "dark", "stack"),
    ("square-courier-bulk-dark",             1080, 1080, "courier_bulk",             "dark", "stack"),
    ("square-fraud-return-history-dark",     1080, 1080, "fraud_return_history",     "dark", "stack"),
    ("square-fraud-blacklist-dark",          1080, 1080, "fraud_blacklist",          "dark", "stack"),
    ("square-fraud-otp-dark",                1080, 1080, "fraud_otp",                "dark", "stack"),
    ("square-payments-gateways-dark",        1080, 1080, "payments_gateways",        "dark", "stack"),
    ("square-payments-wallet-dark",          1080, 1080, "payments_wallet",          "dark", "stack"),
    ("square-payments-choice-dark",          1080, 1080, "payments_choice",          "dark", "stack"),
    ("square-marketing-sms-dark",            1080, 1080, "marketing_sms",            "dark", "stack"),
    ("square-marketing-notification-dark",   1080, 1080, "marketing_notification",   "dark", "stack"),
    ("square-storefront-themes-dark",        1080, 1080, "storefront_themes",        "dark", "stack"),
    ("square-storefront-reviews-dark",       1080, 1080, "storefront_reviews",       "dark", "stack"),
    ("square-storefront-seo-dark",           1080, 1080, "storefront_seo",           "dark", "stack"),
    ("square-hosting-speed-dark",            1080, 1080, "hosting_speed",            "dark", "stack"),
    ("square-hosting-ssl-dark",              1080, 1080, "hosting_ssl",              "dark", "stack"),
    ("square-accounting-ledger-dark",        1080, 1080, "accounting_ledger",        "dark", "stack"),
    ("square-accounting-courier-charge-dark",1080, 1080, "accounting_courier_charge","dark", "stack"),
    ("square-accounting-reports-dark",       1080, 1080, "accounting_reports",       "dark", "stack"),
    ("square-collection-sources-dark",       1080, 1080, "collection_sources",       "dark", "stack"),
    ("square-collection-staff-filter-dark",  1080, 1080, "collection_staff_filter",  "dark", "stack"),
    ("square-staff-roles-dark",              1080, 1080, "staff_roles",              "dark", "stack"),
    ("square-staff-owner-control-dark",      1080, 1080, "staff_owner_control",      "dark", "stack"),
    ("square-staff-tracking-dark",           1080, 1080, "staff_tracking",           "dark", "stack"),
    ("square-invoice-branded-dark",          1080, 1080, "invoice_branded",          "dark", "stack"),
    ("square-invoice-instant-dark",          1080, 1080, "invoice_instant",          "dark", "stack"),
    ("square-bulk-products-dark",            1080, 1080, "bulk_products",            "dark", "stack"),
    ("square-bulk-orders-dark",              1080, 1080, "bulk_orders",              "dark", "stack"),
    ("square-bulk-validation-dark",          1080, 1080, "bulk_validation",          "dark", "stack"),
    ("square-onboarding-checklist-dark",     1080, 1080, "onboarding_checklist",     "dark", "stack"),
    ("square-onboarding-demo-dark",          1080, 1080, "onboarding_demo",          "dark", "stack"),
    ("square-onboarding-help-dark",          1080, 1080, "onboarding_help",          "dark", "stack"),
    ("square-ai-diagnosis-dark",             1080, 1080, "ai_diagnosis",             "dark", "stack"),
    ("square-ai-helpbutton-dark",            1080, 1080, "ai_helpbutton",            "dark", "stack"),
    ("square-ai-escalation-dark",            1080, 1080, "ai_escalation",            "dark", "stack"),
    ("square-woo-sync-dark",                 1080, 1080, "woo_sync",                 "dark", "stack"),
    ("square-woo-courier-payment-dark",      1080, 1080, "woo_courier_payment",      "dark", "stack"),
    ("square-woo-extra-dark",                1080, 1080, "woo_extra",                "dark", "stack"),
    ("square-analytics-sales-dark",          1080, 1080, "analytics_sales",          "dark", "stack"),
    ("square-analytics-customer-dark",       1080, 1080, "analytics_customer",       "dark", "stack"),
    ("square-analytics-courier-dark",        1080, 1080, "analytics_courier",        "dark", "stack"),
    ("square-security-totp-dark",            1080, 1080, "security_totp",            "dark", "stack"),
    ("square-security-audit-dark",           1080, 1080, "security_audit",           "dark", "stack"),

    # Portrait 1080x1350 — Instagram feed portrait
    ("portrait-master-dark", 1080, 1350, "master", "dark", "stack"),
    ("portrait-trust-dark",  1080, 1350, "trust",  "dark", "stack"),

    # Story/Reels 1080x1920 — Facebook & Instagram Stories/Reels
    ("story-master-dark", 1080, 1920, "master",   "dark", "stack"),
    ("story-cta-dark",    1080, 1920, "cta_free", "dark", "stack"),

    # Compact thumbnail 400x400 — small placements/previews
    ("thumbnail-master-dark", 400, 400, "master", "dark", "thumbnail"),

    # Facebook Page assets
    ("fb-page-profile-dark",  500, 500, "master", "dark",  "profile"),
    ("fb-page-cover-dark",    820, 312, "master", "dark",  "cover"),
    ("fb-page-cover-light",   820, 312, "master", "light", "cover"),
]

os.makedirs(SVG_DIR, exist_ok=True)
for name, w, h, theme_key, style, layout in MANIFEST:
    theme = THEMES[theme_key]
    if layout == "landscape":
        svg = render_landscape(w, h, theme, style)
    elif layout == "thumbnail":
        svg = render_thumbnail(w, h, theme, style)
    elif layout == "profile":
        svg = render_profile(w, h, style)
    elif layout == "cover":
        svg = render_cover(w, h, theme, style)
    else:
        svg = render_stack(w, h, theme, style)
    with open(f"{SVG_DIR}/{name}.svg", "w") as f:
        f.write(svg)

print(f"Generated {len(MANIFEST)} SVGs into {SVG_DIR}")
