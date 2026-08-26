"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

/**
 * BSOL's own acquisition-funnel Pixel (platform_marketing_tracking_context.md)
 * — distinct from any seller's storefront pixel (storefront tracking is a
 * separate, per-seller destination under app/store/*). Mounted only on the
 * homepage and /verify-phone, never in the root layout — a seller's own
 * dashboard/storefront pages have no reason to load BSOL's ad pixel.
 *
 * The Pixel ID comes from GET /api/public/marketing-pixel (backed by the
 * admin-editable platform_facebook_settings row) rather than a build-time
 * env var, so an admin entering it in Admin → Settings → Facebook takes
 * effect immediately, no frontend rebuild needed. Renders nothing while
 * unset — silent no-op until an admin configures one.
 *
 * `autoPageView=false` (the homepage's choice) suppresses the base code's
 * own PageView — same reasoning frontend/src/lib/tracking.ts documents for
 * the seller pipeline: every event, including the first PageView, needs an
 * eventID so it can be dual-fired (fbq + same-origin relay, see
 * homepage-engagement-tracking.ts) without Meta double-counting it.
 */
export default function MetaPixelScript({ autoPageView = true }: { autoPageView?: boolean } = {}) {
  const [pixelId, setPixelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/public/marketing-pixel`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.data?.pixel_id) setPixelId(data.data.pixel_id as string);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!pixelId) return null;

  return (
    <Script id="meta-pixel-base" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        ${autoPageView ? "fbq('track', 'PageView');" : ""}
      `}
    </Script>
  );
}
