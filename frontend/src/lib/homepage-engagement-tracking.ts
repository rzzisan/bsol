"use client";

import { useEffect } from "react";

/**
 * Engagement signals for BSOL's own homepage — platform_marketing_tracking_context.md.
 * Browser-only (no CAPI/server round trip, no PII to hash): a visitor is
 * anonymous at this point, so these exist purely to build retargeting/
 * lookalike Custom Audiences in Ads Manager, not to feed the CompleteRegistration/
 * Subscribe conversion pipeline (OtpController/SubscriptionActivationService).
 *
 * Each signal is naturally bounce-resistant on its own — no page-wide dwell
 * timer needed: ViewContent requires ~1s of continuous visibility (filters a
 * fast scroll-past), ScrollDepth only fires once actually reached, Lead is
 * click-triggered. `firedEvents` is a module-level dedupe set (per page
 * load) so re-scrolling a section in/out never double-counts it.
 */
const firedEvents = new Set<string>();

function track(eventName: string, customData?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", eventName, customData);
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
