import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Per-seller subdomain gate (custom_domain_context.md §4.1).
 *
 * DNS is a wildcard, so *every* label under the apex reaches this app —
 * including ones nobody owns. Without this check a stranger could point
 * anything (say a look-alike login name) at the real dashboard. So a
 * subdomain that isn't a live shop is answered with 404 instead.
 *
 * Next.js 16 renamed Middleware to Proxy; this file is `proxy.ts`, not
 * `middleware.ts`, and runs on the Node.js runtime by default.
 */

const APEX = (process.env.NEXT_PUBLIC_SUBDOMAIN_APEX ?? "zyrotechbd.com").toLowerCase();
const PLATFORM_HOST = `bsol.${APEX}`;
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/**
 * Set by this proxy and trusted downstream, so it must never be accepted
 * from a client — see the strip in proxy() below.
 */
const SHOP_HEADER = "x-bsol-shop-subdomain";

const POSITIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;

// Module scope persists between requests within a worker, so a busy shop
// costs one resolver call every few minutes rather than one per request.
// Proxy runs before the data cache, so fetch's own caching options are
// documented as having no effect here — this has to be done by hand.
type Resolution = { exists: boolean; movedTo: string | null };

const cache = new Map<string, Resolution & { until: number }>();

/** The single label under the apex, or null if this host isn't a seller subdomain. */
function sellerLabel(host: string): string | null {
  const bare = host.toLowerCase().split(":")[0];

  if (bare === PLATFORM_HOST || !bare.endsWith(`.${APEX}`)) {
    return null;
  }

  const label = bare.slice(0, -(APEX.length + 1));

  // Multi-level names (www.bsol.<apex>) aren't seller subdomains and aren't
  // covered by the one-level wildcard certificate either.
  return label.includes(".") ? null : label;
}

async function resolveShop(label: string): Promise<Resolution> {
  const hit = cache.get(label);
  if (hit && hit.until > Date.now()) {
    return hit;
  }

  try {
    const res = await fetch(`${API_BASE}/public/shop-by-subdomain/${encodeURIComponent(label)}`, {
      headers: { Accept: "application/json" },
    });

    const body = await res.json().catch(() => ({}));
    const resolution: Resolution = {
      exists: res.ok,
      movedTo: typeof body?.moved_to === "string" ? body.moved_to : null,
    };

    cache.set(label, {
      ...resolution,
      until: Date.now() + (resolution.exists ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });

    return resolution;
  } catch {
    // Fail open, matching how every other storefront-facing remote check in
    // this codebase behaves: a backend blip must not take every seller's
    // dashboard offline. Not cached, so it retries on the next request.
    return { exists: true, movedTo: null };
  }
}

function notFound(label: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>Shop not found</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;` +
      `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">` +
      `<div style="text-align:center;padding:24px">` +
      `<h1 style="font-size:20px;margin:0 0 8px">এই ঠিকানায় কোনো শপ নেই</h1>` +
      `<p style="margin:0;color:#94a3b8;font-size:14px">No shop is registered at ` +
      `<strong>${label}.${APEX}</strong>.</p></div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Top-level paths that belong to the app itself, so a landing page can never
 * shadow them. Kept in sync with the route folders under src/app —
 * custom_domain_context.md §4.3.
 */
const APP_PATHS = new Set([
  "dashboard",
  "admin",
  "auth",
  "lp",
  "store",
  "privacy",
  "terms",
  "forgot-password",
  "verify-email",
  "verify-phone",
]);

/**
 * True for `/offer` and `/offer/thank-you`, false for `/`, `/dashboard/...`
 * and anything deeper. The thank-you step is included so the whole checkout
 * stays on the seller's address — a mid-checkout hop to /lp/ would drop the
 * _fbp/_fbc cookies that tracking depends on (tracking_capi_context.md §8).
 */
function isLandingSlugPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || segments.length > 2) return false;
  if (segments.length === 2 && segments[1] !== "thank-you") return false;

  return !APP_PATHS.has(segments[0]) && !segments[0].includes(".");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /lp/ is the internal render target the rewrite below points at, not a
  // public address — landing pages live only on their seller's own host.
  // Blocking it here is safe because a rewrite does not re-enter the proxy.
  if (pathname === "/lp" || pathname.startsWith("/lp/")) {
    return new NextResponse(null, { status: 404 });
  }

  const label = sellerLabel(request.headers.get("host") ?? "");

  if (!label) {
    // Strip any inbound copy of the trusted header before the app sees it.
    // Downstream code treats its presence as proof the proxy resolved a
    // seller subdomain; on the platform host nothing overwrites it, so a
    // client could otherwise simply send one.
    if (request.headers.has(SHOP_HEADER)) {
      const headers = new Headers(request.headers);
      headers.delete(SHOP_HEADER);

      return NextResponse.next({ request: { headers } });
    }

    return NextResponse.next();
  }

  const shop = await resolveShop(label);

  if (!shop.exists) {
    // A renamed shop keeps its old address working: ad links, bookmarks and
    // anything already shared would otherwise dead-end
    // (custom_domain_context.md §11.2).
    if (shop.movedTo) {
      const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${shop.movedTo}`);

      return NextResponse.redirect(target, 301);
    }

    return notFound(label);
  }

  // Forwarded so server components can render shop-specific output without
  // re-deriving the label from the Host header themselves.
  const headers = new Headers(request.headers);
  headers.set(SHOP_HEADER, label);

  // seller1.<apex>/offer renders the landing page route. A rewrite, not a
  // redirect: the seller's own address is the canonical one, so /lp/ must
  // never appear in the URL bar or in an ad's destination.
  if (isLandingSlugPath(pathname)) {
    return NextResponse.rewrite(new URL(`/lp${pathname}`, request.url), {
      request: { headers },
    });
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // /api never reaches Next.js (nginx routes it straight to Laravel), but
  // excluding it keeps the intent obvious alongside the static paths.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
