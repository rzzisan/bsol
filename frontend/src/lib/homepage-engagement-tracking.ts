"use client";

import { useEffect } from "react";

/**
 * Engagement signals for BSOL's own homepage — platform_marketing_tracking_context.md.
 * No PII to hash (a visitor is anonymous at this point) — these exist to
 * build retargeting/lookalike Custom Audiences, not to feed the
 * CompleteRegistration/Subscribe conversion pipeline.
 *
 * Each signal fires two ways with the same event_id, mirroring the seller
 * landing-page pattern (frontend/src/lib/tracking.ts's sendEvent()):
 *  1. window.fbq(...) directly — works when nothing blocks the browser Pixel.
 *  2. A same-origin POST to /api/public/marketing-track, relayed to Meta
 *     server-side by PublicMarketingTrackController. Verified empirically
 *     that connect.facebook.net (the Pixel script's own domain) is one of
 *     the most commonly ad-blocked requests on the web — general internet
 *     and even graph.facebook.com stayed reachable while that one domain
 *     specifically failed. A same-origin request to our own domain isn't a
 *     recognizable tracking endpoint, so it goes through regardless, and
 *     Meta dedupes the pair on event_id if both arrive.
 *
 * Each signal is also naturally bounce-resistant on its own — no page-wide
 * dwell timer needed: ViewContent requires ~1s of continuous visibility
 * (filters a fast scroll-past), ScrollDepth only fires once actually
 * reached, Lead is click-triggered. `firedEvents` is a module-level dedupe
 * set (per page load) so re-scrolling a section in/out never double-counts it.
 */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

const firedEvents = new Set<string>();

function randomEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function relayToServer(eventName: string, eventId: string, customData?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const fbc = readCookie("_fbc");
  const fbclid = fbc ? null : new URLSearchParams(window.location.search).get("fbclid");

  fetch(`${API_BASE_URL}/public/marketing-track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: customData ?? null,
      user_data: { fbp: readCookie("_fbp"), fbc, fbclid },
    }),
    keepalive: true, // survives a navigation right after (e.g. Lead → clicking into the register form)
  }).catch(() => {});
}

function track(eventName: string, customData?: Record<string, unknown>) {
  const eventId = randomEventId();
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, customData, { eventID: eventId });
  }
  relayToServer(eventName, eventId, customData);
}

/**
 * Fires PageView once on mount — the homepage's base Pixel script has its
 * own auto-fire suppressed (see MetaPixelScript's `autoPageView` prop) so
 * this one call is the single source of truth, dual-fired like every other
 * signal here.
 */
export function usePageViewTracking() {
  useEffect(() => {
    track("PageView");
    // Fires once per mount by design — a dependency here would re-fire on
    // an unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Fires Meta's standard ViewContent once `sectionRef`'s element has been at
 * least 50% visible continuously for ~1s. `sectionName` becomes
 * `content_name` — lets Ads Manager segment "who cared about pricing" from
 * "who cared about features" for retargeting.
 */
export function useViewContentOnVisible(sectionRef: React.RefObject<HTMLElement | null>, sectionName: string) {
  useEffect(() => {
    const el = sectionRef.current;
    const key = `view_content_${sectionName}`;
    if (!el || typeof IntersectionObserver === "undefined" || firedEvents.has(key)) return;

    let timer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = window.setTimeout(() => {
            if (!firedEvents.has(key)) {
              firedEvents.add(key);
              track("ViewContent", { content_name: sectionName, content_type: "homepage_section" });
            }
            observer.disconnect();
          }, 1000);
        } else if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionName]);
}

/** Fires a custom `ScrollDepth` event (percentage in custom_data) the first time a visitor crosses 75% and 90% of page height. */
export function useScrollDepthTracking() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const thresholds = [75, 90];
    let ticking = false;

    function check() {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = (window.scrollY / scrollable) * 100;

      for (const threshold of thresholds) {
        const key = `scroll_depth_${threshold}`;
        if (percent >= threshold && !firedEvents.has(key)) {
          firedEvents.add(key);
          track("ScrollDepth", { percentage: threshold });
        }
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    check(); // covers a visitor who lands already scrolled (e.g. #features deep link)
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/** Meta's standard Lead — genuine intent (opened the registration tab) before an account actually exists. */
export function trackLead(source: string) {
  const key = `lead_${source}`;
  if (firedEvents.has(key)) return;
  firedEvents.add(key);
  track("Lead", { content_name: source });
}
