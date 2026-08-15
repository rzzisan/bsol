"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Browser-side half of BSOL's tracking pipeline — a seller's own landing
 * page (tracking_capi_context.md §8.8). Everything here talks to
 * POST /api/public/track, which is same-origin on the seller's own
 * subdomain (§8.1/§8.3), so there is no API key and no CORS concern.
 *
 * Never on /dashboard/* — this module is only ever imported by the public
 * landing-page view and the thank-you page (§8.3's "Pixel never on the
 * dashboard" constraint).
 */

export type TrackingConfig = { enabled: boolean; pixel_id: string | null } | null | undefined;

interface FbqFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: FbqFunction;
  loaded?: boolean;
  version?: string;
}

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  // Exact-host only, no `domain=` attribute — custom_domain_context.md §2's
  // hard constraint applies to every cookie this module writes, not just
  // the auth ones it was originally written for.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function randomEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * event_id for a funnel step that should dedupe repeats within a window
 * (ViewContent/InitiateCheckout/Lead — §3.2's "১ ঘণ্টা bucket" rule),
 * unlike PageView which is deliberately fresh every load.
 */
function getOrCreateBucketedEventId(key: string, ttlSeconds: number): string {
  const cookieName = `bsol_eid_${key}`;
  const existing = getCookie(cookieName);
  if (existing) return existing;
  const id = randomEventId();
  setCookie(cookieName, id, ttlSeconds);
  return id;
}

function getFbp(): string | null {
  return getCookie("_fbp");
}

function getFbc(): string | null {
  return getCookie("_fbc");
}

/** Loads Meta's Pixel base code once. A second call with the same id is a cheap no-op (fbq('init', ...) is idempotent). */
function ensureMetaPixelLoaded(pixelId: string) {
  if (typeof window === "undefined") return;

  if (!window.fbq) {
    const fbq: FbqFunction = (...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue.push(args);
      }
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  // No automatic fbq('track', 'PageView') here — the base code's default
  // is suppressed on purpose (§7 item 1) so every event, including the
  // first PageView, always carries an eventID for server-side dedup.
  window.fbq("init", pixelId);
}

function fbqTrack(eventName: string, eventId: string, customData: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", eventName, customData, { eventID: eventId });
}

type PublicTrackPayload = {
  slug?: string;
  event_name: string;
  event_id: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  user_data?: Record<string, unknown>;
};

function postTrackingEvent(payload: PublicTrackPayload) {
  if (typeof window === "undefined") return;

  const userData = Object.fromEntries(
    Object.entries(payload.user_data ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  );

  fetch("/api/public/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, user_data: userData }),
    // Lets the request survive a navigation that starts right after —
    // Purchase fires on the thank-you page itself so this mostly matters
    // for InitiateCheckout firing right before the order submit navigates.
    keepalive: true,
  }).catch(() => {});
}

function fbclidFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("fbclid");
}

/** @param customData Passed to both fbq('track', ...) and the server event — kept identical so browser/server Event Match Quality reporting agrees. */
function sendEvent(pixelId: string | null, slug: string, eventName: string, eventId: string, customData: Record<string, unknown> = {}) {
  if (pixelId) fbqTrack(eventName, eventId, customData);

  const fbc = getFbc();
  postTrackingEvent({
    slug,
    event_name: eventName,
    event_id: eventId,
    event_source_url: window.location.href,
    custom_data: customData,
    user_data: {
      fbp: getFbp(),
      fbc,
      // The server only needs fbclid when there's no _fbc cookie yet to
      // synthesise one from it (TrackingUserDataBuilder::fbcFromClickId) —
      // sending it otherwise would just be dead weight in the payload.
      fbclid: fbc ? undefined : fbclidFromUrl(),
    },
  });
}

/**
 * The funnel this hook drives is PageView / ViewContent (both on mount) /
 * InitiateCheckout / Lead (both caller-triggered, once) / Purchase
 * (caller-triggered on the thank-you page) — §8.8's exact list. AddToCart
 * doesn't apply here: a BSOL landing page has no separate cart step, the
 * whole page already is "the content".
 *
 * `disabled` should be true in the editor's live-preview iframe (a preview
 * render is not a real visit) and whenever tracking.enabled is false.
 */
export function useBsolTracking(
  page: { slug: string; tracking?: TrackingConfig },
  opts: { disabled?: boolean } = {},
) {
  const disabled = Boolean(opts.disabled) || !page.tracking?.enabled;
  const pixelId = page.tracking?.pixel_id ?? null;
  const slug = page.slug;
  const firedOnMountRef = useRef(false);

  useEffect(() => {
    if (disabled || firedOnMountRef.current) return;
    firedOnMountRef.current = true;

    if (pixelId) ensureMetaPixelLoaded(pixelId);

    sendEvent(pixelId, slug, "PageView", randomEventId());
    sendEvent(pixelId, slug, "ViewContent", getOrCreateBucketedEventId(`vc_${slug}`, 3600), { content_type: "product" });
    // Fires once per mount by design (firedOnMountRef) — re-running on a
    // dependency change would double-count the same page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const trackInitiateCheckout = useCallback(() => {
    if (disabled) return;
    sendEvent(pixelId, slug, "InitiateCheckout", getOrCreateBucketedEventId(`ic_${slug}`, 3600));
  }, [disabled, pixelId, slug]);

  const trackLead = useCallback(() => {
    if (disabled) return;
    sendEvent(pixelId, slug, "Lead", getOrCreateBucketedEventId(`lead_${slug}`, 3600));
  }, [disabled, pixelId, slug]);

  const trackPurchase = useCallback(
    (orderId: number, customData: Record<string, unknown> = {}) => {
      if (disabled) return;
      // order_{id}, deterministic and identical to the server-side CAPI
      // event's own id (SendFacebookCapiPurchaseEventJob) — this is the
      // dedup pair Meta matches on (§3.2).
      sendEvent(pixelId, slug, "Purchase", `order_${orderId}`, customData);
    },
    [disabled, pixelId, slug],
  );

  return { trackInitiateCheckout, trackLead, trackPurchase };
}
