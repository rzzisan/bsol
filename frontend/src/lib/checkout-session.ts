const STORAGE_KEY = "zayroo_checkout_session_token";

/**
 * One token per browser tab session (sessionStorage, not localStorage) —
 * closing the tab and coming back is a fresh visit attempt, matching the
 * "one abandoned-checkout row per attempt" semantics on the backend.
 */
export function getOrCreateCheckoutSessionToken(): string {
  if (typeof window === "undefined") return "";

  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const token = crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, token);
  return token;
}

/** Adopt a resumed checkout's token so subsequent capture calls update the same row. */
export function setCheckoutSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, token);
}
