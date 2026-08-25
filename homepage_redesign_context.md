# Public Marketing Homepage Redesign

`frontend/src/app/page.tsx` — the platform's own public homepage (root domain, `bsol.zyrotechbd.com/`), not a seller's storefront/landing page. Master context: `SAAS_MODULE_CONTEXT.md`.

Last updated: 2026-08-25 — Full content + design redesign, done in one pass. User request (verbatim intent): visiting the homepage should give a full picture of every feature, load with visual animation, be mobile-responsive, name the payment gateways, explain what problems the SaaS solves and what new value it adds (business transparency, time saved), and be usable as a Facebook ad landing page.

## What changed

The previous homepage was written at MVP stage — 5 generic "modules", a stale "MVP Roadmap" section, no payment gateway/courier names, no problem/solution framing. The platform has since shipped far more (this session's SaaS billing work alone was step 5 of 6). Content was rewritten from scratch, grounded in what's actually built (cross-checked against `PaymentGatewayFactory`/`CourierFactory` for exact names, not invented):

- **Hero** — rewritten headline/subtitle around the actual value prop, animated entrance (CSS `home-fade-up`, staggered), two subtle floating gradient blobs (kept low-opacity/negative-z-index after a first pass made hero subtitle text low-contrast in dark mode — fixed before shipping).
- **Stat strip** — real numbers (5+ couriers, 7+ payment gateways, 15+ core modules, 24/7) replacing the old generic set.
- **New "Problems → Solutions" section** — 4 pain-point/solution pairs, directly answering "কি কি সমস্যা সমাধান করে".
- **Feature showcase rebuilt as 7 categories** (Orders & Courier, Fraud & Risk, Marketing/CRM/Automation, Storefront & Landing Pages, Accounting & Insights, Team & Access Control, Platform) instead of 5 flat cards — each with 3-4 concrete bullet items, so the page reads as comprehensive without being a wall of text.
- **New Payments + Couriers section** — names all 7 automated gateways (SSLCommerz, bKash, Nagad, AamarPay, ZiniPay, ShurjoPay, EPS) confirmed from `PaymentGatewayFactory::$providers`, notes the personal-wallet send-and-verify fallback (no merchant account needed), and all 5 couriers (Pathao, Steadfast, RedX, Carrybee, Paperfly) confirmed from `CourierFactory::$providers`.
- **Benefits section** — reworded around transparency/time-saving/fraud-protection per the user's explicit ask, each item now has a title + one-line detail (was title-only before).
- **Replaced the stale "MVP Roadmap"** (3 build-phase cards, meaningless to a visitor) **with "How it works"** — 3 actual onboarding steps (register → connect courier/payment → sell), which is what a visitor/ad-click actually needs.
- **Scroll-reveal animation** — new reusable `Reveal` component (IntersectionObserver + CSS transition, `globals.css`'s `.home-reveal`/`.is-visible`), applied to every section below the fold; respects `prefers-reduced-motion` (motion fully disabled, content stays visible).
- **Auth card / login / registration flow — untouched**, copied verbatim (already working, no reason to touch).
- **OG/Twitter metadata** added to `app/layout.tsx` (previously generic placeholder title/description) — Bangla title+description matching the new positioning. `og:image` now points at a purpose-built `frontend/public/og-banner.png` (1200×630 exactly, see §"1200×630 banner" below) rather than the square app icon that shipped first.

## 1200×630 OG/ad banner (added 2026-08-25)

No image-generation tool or headless browser was available for this. Built via a local SVG → raster pipeline instead, entirely on-server:

- `frontend/node_modules/sharp` (already a transitive Next.js dependency, bundles its own SVG rasterizer) rendering a hand-written SVG — no Puppeteer/Chromium install needed.
- The SVG mirrors the homepage hero's design language (dark gradient, teal glow blobs, grid texture, brand mark, headline, 4 feature chips, 3 stats, CTA pill) with the same Bangla copy as the hero.
- **Bangla glyphs**: `sharp`'s rasterizer has no Bangla-capable font by default (confirmed via `fc-list` — none installed system-wide). Reused the `NotoSansBengali-{Regular,Bold}.ttf` files already sitting in `backend/storage/fonts/` (downloaded earlier for the PDF-invoice feature, subscription_billing_context.md §7.1) — copied them into `~/.local/share/fonts/`. The `fc-cache`/`fc-list` CLI tools aren't installed on this box (no sudo access to install them), but `libfontconfig1` itself is, and it still discovers fonts in standard XDG directories via a live directory scan even without a prebuilt cache — confirmed working by inspecting the rendered output, not just assumed.
- Chip pill widths are hand-computed (proportional to each string's character count) rather than auto-sized — SVG `<text>` has no intrinsic-width layout the way HTML/CSS does. Iterated once: the first pass overflowed the canvas on the longest chip ("Facebook + WhatsApp মার্কেটিং"), caught by visually inspecting the rendered PNG (via the `Read` tool, which can view images) and re-tuned.
- Generator script: `gen_banner.py` (scratchpad, not checked in — a one-off build tool, not part of the app) embeds the existing `app-icon-1024.png` as a base64 `<image>` inside the SVG, then `sharp(...).resize(1200,630).png().toFile(...)`. Output copied to `frontend/public/og-banner.png` (153KB).
- Verified live: `curl`'d the deployed PNG and confirmed exactly 1200×630 via `sharp().metadata()`, and confirmed `og:image`/`og:image:width`/`og:image:height` in the served HTML point at it.

## Verification

- `npx tsc --noEmit` clean (twice — once after the initial write, once after the blob-opacity fix).
- `deploy-safe.sh` 8/8 pass (twice, same reason).
- **Live visual verification via claude-in-chrome** (this was a design-heavy change, so visual QA mattered more than usual): desktop (1440px) screenshots of hero → problems → features → payments/couriers/scroll-reveal firing correctly; a narrow (~500px) viewport confirmed mobile responsiveness (stacking, wrapping, full-width CTAs); both dark and light theme; both bn and en locale. First pass showed the hero subtitle text at low contrast against the new decorative blobs in dark mode — fixed by cutting blob opacity (30%/18% → 12%/10%) and moving them to `-z-10` further off to the sides, redeployed, re-verified clean.
- `curl` against production confirmed `og:*`/`twitter:*` meta tags render with the correct content.

## Not done in this pass

- No A/B copy testing — this is a single reasoned pass, not iterated against real ad performance data.
- Feature-category bullet copy is intentionally compressed (3-4 lines per category out of a much longer real feature list) to stay skimmable; the full detail lives in each dashboard module, not this page.
