"""Century Link Network - Entertainment package poster.
Physical size 2ft x 3ft (24in x 36in). viewBox is 2400 x 3600 so 1 unit = 0.01in.
Rasterized at 150 dpi -> 3600 x 5400 px.
"""
import os, math

OUT = os.environ.get("OUT", ".")
W, H = 2400, 3600

# Contact details - single place to edit (or override via env vars).
PHONE = os.environ.get("PHONE", "09613009900, 01777858289")
ADDRESS = os.environ.get("ADDRESS", "রিকাবি বাজার, মিরকাদিম, মুন্সিগঞ্জ সদর")

ORANGE = "#F26A0F"
ORANGE_DEEP = "#D4560A"
ORANGE_SOFT = "#FFF1E4"
INK = "#1E1612"
WHITE = "#FFFFFF"
YELLOW = "#FFC933"

import base64, struct
LOGO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logos")
LOGO_B64, LOGO_SIZE = {}, {}
for _k in ("bongo", "chorki"):
    _raw = open(os.path.join(LOGO_DIR, _k + ".png"), "rb").read()
    LOGO_B64[_k] = base64.b64encode(_raw).decode("ascii")
    LOGO_SIZE[_k] = struct.unpack(">II", _raw[16:24])  # PNG IHDR width, height

BN = "Anek Bangla"
LAT = "Poppins"


def logo_mark(x, y, s, uid="m"):
    """C ring (Century) opening to the right, with a signal radiating out of it (Network)."""
    cx, cy = x + s / 2, y + s / 2
    t = s * 0.21
    r = s / 2 - t / 2
    ang = math.radians(48)
    ux, uy = cx + r * math.cos(ang), cy - r * math.sin(ang)
    lx, ly = cx + r * math.cos(ang), cy + r * math.sin(ang)
    out = [
        f'<defs><linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="#FF8A2B"/><stop offset="1" stop-color="#E04F00"/></linearGradient></defs>',
        f'<path d="M {ux:.1f} {uy:.1f} A {r:.1f} {r:.1f} 0 1 0 {lx:.1f} {ly:.1f}" fill="none" '
        f'stroke="url(#{uid}g)" stroke-width="{t:.1f}" stroke-linecap="round"/>',
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{s*0.075:.1f}" fill="{INK}"/>',
    ]
    half = math.radians(26)
    for rad in (0.176, 0.28, 0.384):
        rr = s * rad
        x1, y1 = cx + rr * math.cos(half), cy - rr * math.sin(half)
        x2, y2 = cx + rr * math.cos(half), cy + rr * math.sin(half)
        out.append(
            f'<path d="M {x1:.1f} {y1:.1f} A {rr:.1f} {rr:.1f} 0 0 1 {x2:.1f} {y2:.1f}" fill="none" '
            f'stroke="{INK}" stroke-width="{s*0.06:.1f}" stroke-linecap="round"/>'
        )
    return "".join(out)


LOGO_S = 270


def lockup(x0, y0, name_size=225, s=LOGO_S):
    """Horizontal logo: mark + 'Century Link' + ruled 'NETWORK'. Returns (svg, total_width)."""
    gap = 56
    name_w = 6.58 * name_size            # measured width ratio of Poppins ExtraBold "Century Link"
    xt = x0 + s + gap
    base_name = y0 + s * 0.55
    net_size = name_size * 0.34
    base_net = y0 + s + 12
    net_half = 3.82 * net_size + 40      # half of tracked "NETWORK" width + rule gap
    cxn = xt + name_w / 2
    ly = base_net - net_size * 0.36
    svg = (
        logo_mark(x0, y0, s)
        + f'<text x="{xt:.1f}" y="{base_name:.1f}" font-family="{LAT}" font-weight="800" font-size="{name_size}" fill="{INK}">Century <tspan fill="{ORANGE}">Link</tspan></text>'
        + f'<text x="{cxn+net_size*0.2:.1f}" y="{base_net:.1f}" text-anchor="middle" font-family="{LAT}" font-weight="600" font-size="{net_size:.1f}" letter-spacing="{net_size*0.45:.1f}" fill="{ORANGE}">NETWORK</text>'
        + f'<line x1="{xt+6:.1f}" y1="{ly:.1f}" x2="{cxn-net_half:.1f}" y2="{ly:.1f}" stroke="{ORANGE}" stroke-width="8" stroke-linecap="round"/>'
        + f'<line x1="{cxn+net_half:.1f}" y1="{ly:.1f}" x2="{xt+name_w-6:.1f}" y2="{ly:.1f}" stroke="{ORANGE}" stroke-width="8" stroke-linecap="round"/>'
    )
    return svg, s + gap + name_w


def build():
    p = []
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    p.append(f'<defs>'
             f'<linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">'
             f'<stop offset="0" stop-color="#FF7A1A"/><stop offset="1" stop-color="{ORANGE_DEEP}"/></linearGradient>'
             f'<clipPath id="heroClip"><rect x="0" y="430" width="{W}" height="1330"/></clipPath>'
             f'</defs>')
    p.append('<!--L:Background (white)-->')
    p.append(f'<rect width="{W}" height="{H}" fill="{WHITE}"/>')

    # ---------------- Header ----------------
    p.append('<!--L:Logo - Century Link Network-->')
    lk, lw = lockup(0, 86)
    p.append(f'<g transform="translate({(W-lw)/2:.1f},0)">{lk}</g>')

    # ---------------- Hero (orange) ----------------
    p.append('<!--L:Hero orange background-->')
    p.append(f'<rect x="0" y="430" width="{W}" height="1330" fill="url(#hero)"/>')
    p.append(f'<g clip-path="url(#heroClip)" fill="{WHITE}">'
             f'<circle cx="2250" cy="420" r="560" fill-opacity="0.07"/>'
             f'<circle cx="2380" cy="560" r="330" fill-opacity="0.07"/>'
             f'<circle cx="60" cy="1700" r="520" fill-opacity="0.06"/></g>')

    # "নতুন প্যাকেজ" tag
    p.append('<!--L:Tag - Notun Package-->')
    p.append(f'<rect x="{W/2-320}" y="462" width="640" height="116" rx="58" fill="{YELLOW}"/>')
    p.append(f'<text x="{W/2}" y="550" text-anchor="middle" font-family="{BN}" font-weight="800" font-size="80" fill="{INK}">নতুন প্যাকেজ</text>')

    # Package name
    p.append('<!--L:Package name - Entertainment-->')
    p.append(f'<text x="{W/2}" y="850" text-anchor="middle" font-family="{BN}" font-weight="800" font-size="272" fill="{WHITE}">এন্টারটেইনমেন্ট</text>')

    # Speed: big number + Mbps
    p.append('<!--L:Speed - 20 Mbps-->')
    p.append(f'<text x="1190" y="1445" text-anchor="end" font-family="{BN}" font-weight="800" font-size="680" fill="{WHITE}">২০</text>')
    p.append(f'<text x="1240" y="1445" font-family="{LAT}" font-weight="800" font-size="280" fill="{YELLOW}">Mbps</text>')
    p.append(f'<text x="1246" y="1135" font-family="{BN}" font-weight="700" font-size="100" fill="{WHITE}" fill-opacity="0.95">হাই-স্পিড ইন্টারনেট</text>')
    p.append('<!--L:Tagline - Binodon-->')
    p.append(f'<text x="{W/2}" y="1650" text-anchor="middle" font-family="{BN}" font-weight="700" font-size="104" fill="{WHITE}">সাথে থাকছে বিনোদনের পুরো আয়োজন</text>')

    # ---------------- OTT ----------------
    p.append('<!--L:OTT band and heading-->')
    p.append(f'<rect x="0" y="1760" width="{W}" height="600" fill="{ORANGE_SOFT}"/>')
    p.append(f'<text x="{W/2}" y="1945" text-anchor="middle" font-family="{BN}" font-weight="800" font-size="118" fill="{INK}">OTT সাবস্ক্রিপশন সহ</text>')
    card_w, card_h, gap = 900, 290, 120
    x1 = W / 2 - gap / 2 - card_w
    x2 = W / 2 + gap / 2
    cy0 = 2005
    for x, key, lh in [(x1, "bongo", 200), (x2, "chorki", 180)]:
        p.append(f'<!--L:OTT card - {key}-->')
        p.append(f'<rect x="{x}" y="{cy0}" width="{card_w}" height="{card_h}" rx="60" fill="{WHITE}" stroke="#F3CBA9" stroke-width="6"/>')
        iw, ih = LOGO_SIZE[key]
        lw = lh * iw / ih
        p.append(f'<image x="{x+(card_w-lw)/2:.1f}" y="{cy0+(card_h-lh)/2:.1f}" width="{lw:.1f}" height="{lh}" href="data:image/png;base64,{LOGO_B64[key]}"/>')
    # plus sign
    p.append('<!--L:OTT plus sign-->')
    p.append(f'<circle cx="{W/2}" cy="{cy0+card_h/2}" r="62" fill="{ORANGE}"/>')
    p.append(f'<rect x="{W/2-34}" y="{cy0+card_h/2-9}" width="68" height="18" rx="9" fill="{WHITE}"/>')
    p.append(f'<rect x="{W/2-9}" y="{cy0+card_h/2-34}" width="18" height="68" rx="9" fill="{WHITE}"/>')

    # ---------------- Price band ----------------
    py = 2360
    p.append('<!--L:Price band and label-->')
    p.append(f'<rect x="0" y="{py}" width="{W}" height="480" fill="{INK}"/>')
    p.append(f'<text x="{W/2}" y="{py+130}" text-anchor="middle" font-family="{BN}" font-weight="700" font-size="88" fill="{WHITE}">প্যাকেজের মূল্য মাত্র</text>')
    p.append('<!--L:Price - 550 taka-->')
    p.append(f'<text x="1330" y="{py+415}" text-anchor="end" font-family="{BN}" font-weight="800" font-size="370" fill="{YELLOW}">৫৫০</text>')
    p.append(f'<text x="1370" y="{py+295}" font-family="{BN}" font-weight="800" font-size="170" fill="{WHITE}">টাকা</text>')
    p.append(f'<text x="1372" y="{py+415}" font-family="{BN}" font-weight="600" font-size="100" fill="{ORANGE}">প্রতি মাসে</text>')

    p.append('<!--L:Terms - Shorto Projojjo-->')
    p.append(f'<text x="{W-150}" y="{py+440}" text-anchor="end" font-family="{BN}" font-weight="500" font-size="46" fill="{WHITE}" fill-opacity="0.75">শর্ত প্রযোজ্য</text>')

    # ---------------- Trust strip ----------------
    ty = 2840
    p.append('<!--L:Trust strip background-->')
    p.append(f'<rect x="0" y="{ty}" width="{W}" height="400" fill="{ORANGE_SOFT}"/>')
    # shield icon + BTRC statement
    sx, sy = 150, ty + 50
    p.append('<!--L:BTRC licence statement-->')
    p.append(f'<path d="M {sx+60} {sy} L {sx+120} {sy+20} L {sx+120} {sy+85} Q {sx+120} {sy+135} {sx+60} {sy+160} Q {sx} {sy+135} {sx} {sy+85} L {sx} {sy+20} Z" fill="{ORANGE}"/>')
    p.append(f'<path d="M {sx+30} {sy+80} L {sx+54} {sy+104} L {sx+92} {sy+56}" fill="none" stroke="{WHITE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>')
    p.append(f'<text x="{sx+170}" y="{sy+62}" font-family="{BN}" font-weight="800" font-size="80" fill="{INK}">অত্র এলাকার একমাত্র BTRC অনুমোদিত</text>')
    p.append(f'<text x="{sx+170}" y="{sy+162}" font-family="{BN}" font-weight="800" font-size="80" fill="{ORANGE_DEEP}">লাইসেন্সপ্রাপ্ত ইন্টারনেট সার্ভিস প্রোভাইডার</text>')
    # unlimited CDN row
    ry = ty + 250
    p.append('<!--L:Unlimited CDN row-->')
    p.append(f'<text x="150" y="{ry+78}" font-family="{BN}" font-weight="800" font-size="78" fill="{INK}">আনলিমিটেড CDN:</text>')
    cx = 880
    for label in ["Facebook", "YouTube", "TikTok"]:
        w = 36 * len(label) + 120
        p.append(f'<rect x="{cx}" y="{ry}" width="{w}" height="110" rx="55" fill="{ORANGE}"/>')
        p.append(f'<text x="{cx+w/2}" y="{ry+76}" text-anchor="middle" font-family="{LAT}" font-weight="700" font-size="54" fill="{WHITE}">{label}</text>')
        cx += w + 36

    # ---------------- Contact bar ----------------
    cy = 3240
    p.append('<!--L:Contact bar background-->')
    p.append(f'<rect x="0" y="{cy}" width="{W}" height="{H-cy}" fill="{ORANGE}"/>')
    p.append('<!--L:Contact text-->')
    p.append(f'<text x="{W/2}" y="{cy+88}" text-anchor="middle" font-family="{BN}" font-weight="700" font-size="64" fill="{WHITE}">সংযোগ নিতে কল করুন</text>')
    p.append(f'<text x="{W/2}" y="{cy+178}" text-anchor="middle" font-family="{LAT}" font-weight="800" font-size="104" fill="{WHITE}">{PHONE}</text>')
    p.append(f'<text x="{W/2}" y="{cy+268}" text-anchor="middle" font-family="{BN}" font-weight="700" font-size="78" fill="{WHITE}" fill-opacity="0.95">{ADDRESS}</text>')

    p.append('</svg>')
    return "\n".join(p)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "century-link-entertainment-poster.svg"), "w") as f:
        f.write(build())
    # standalone logo files (transparent background)
    pad = 60
    lk, lw = lockup(pad, pad)
    with open(os.path.join(OUT, "century-link-network-logo.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{lw+2*pad:.0f}" height="{LOGO_S+2*pad+12}" viewBox="0 0 {lw+2*pad:.0f} {LOGO_S+2*pad+12}">{lk}</svg>')
    with open(os.path.join(OUT, "century-link-network-mark.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{LOGO_S+2*pad}" height="{LOGO_S+2*pad}" viewBox="0 0 {LOGO_S+2*pad} {LOGO_S+2*pad}">{logo_mark(pad, pad, LOGO_S)}</svg>')
    print("wrote svg")
