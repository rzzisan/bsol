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

    # Square 1080x1080 — Facebook/Instagram feed
    ("square-master-dark",  1080, 1080, "master",   "dark",  "stack"),
    ("square-master-light", 1080, 1080, "master",   "light", "stack"),
    ("square-cta-dark",     1080, 1080, "cta_free", "dark",  "stack"),

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
