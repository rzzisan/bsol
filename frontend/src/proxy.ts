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

const POSITIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;

// Module scope persists between requests within a worker, so a busy shop
// costs one resolver call every few minutes rather than one per request.
// Proxy runs before the data cache, so fetch's own caching options are
// documented as having no effect here — this has to be done by hand.
const cache = new Map<string, { exists: boolean; until: number }>();

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

async function shopExists(label: string): Promise<boolean> {
  const hit = cache.get(label);
  if (hit && hit.until > Date.now()) {
    return hit.exists;
  }

  try {
    const res = await fetch(`${API_BASE}/public/shop-by-subdomain/${encodeURIComponent(label)}`, {
      headers: { Accept: "application/json" },
    });

    const exists = res.ok;
    cache.set(label, {
      exists,
      until: Date.now() + (exists ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });

    return exists;
  } catch {
    // Fail open, matching how every other storefront-facing remote check in
    // this codebase behaves: a backend blip must not take every seller's
    // dashboard offline. Not cached, so it retries on the next request.
    return true;
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

export async function proxy(request: NextRequest) {
  const label = sellerLabel(request.headers.get("host") ?? "");

  if (!label) {
    return NextResponse.next();
  }

  if (!(await shopExists(label))) {
    return notFound(label);
  }

  // Forwarded so server components can render shop-specific output without
  // re-deriving the label from the Host header themselves.
  const headers = new Headers(request.headers);
  headers.set("x-bsol-shop-subdomain", label);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // /api never reaches Next.js (nginx routes it straight to Laravel), but
  // excluding it keeps the intent obvious alongside the static paths.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
