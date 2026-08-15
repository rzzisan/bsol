export type Locale = "bn" | "en";
export type ThemeMode = "dark" | "light";

export const LOCALE_STORAGE_KEY = "preferred_locale";
export const THEME_STORAGE_KEY = "preferred_theme";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  mobile_verified_at?: string | null;
  email_verified_at?: string | null;
  role?: "admin" | "user";
  // Staff/Team sub-account role — see staff_team_role_context.md §3.7.
  // These come as sibling keys on the /login and /me API responses (not
  // nested inside `user`), so callers must merge them via mergeAuthPayload()
  // before persisting — see that function below.
  is_staff?: boolean;
  must_change_password?: boolean;
  onboarding?: OnboardingState;
  owner_name?: string | null;
  permissions?: Record<string, boolean>;
}

/** Canonical module keys for staff permission gating — mirrors
 *  StaffPermission::MODULE_KEYS on the backend. Phase 1 only wires up the
 *  first five in the UI (menu filtering, staff-management checkbox grid);
 *  the rest are listed here so Phase 2 doesn't have to touch this constant. */
export const STAFF_MODULE_KEYS = [
  "orders",
  "products",
  "customers",
  "courier",
  "sms",
  "accounting",
  "analytics",
  "landing_pages",
  "fraud",
  "facebook",
] as const;

export type StaffModuleKey = (typeof STAFF_MODULE_KEYS)[number];

/** Owner/admin accounts always have full access; a staff sub-account needs
 *  an explicit enabled grant for the module. Mirrors User::hasStaffPermission(). */
export function hasModuleAccess(user: AuthUser | null, moduleKey: StaffModuleKey): boolean {
  if (!user?.is_staff) return true;
  return user.permissions?.[moduleKey] === true;
}

export type OnboardingState = {
  required: boolean;
  needs_shop_profile: boolean;
  needs_subdomain: boolean;
  subdomain_host: string | null;
};

/** Flattens a /login or /me API response (`{ user, is_staff, must_change_password,
 *  owner_name, permissions }`) into a single AuthUser object for storage. */
export function mergeAuthPayload(payload: {
  user: AuthUser;
  is_staff?: boolean;
  must_change_password?: boolean;
  onboarding?: OnboardingState;
  owner_name?: string | null;
  permissions?: Record<string, boolean>;
}): AuthUser {
  return {
    ...payload.user,
    is_staff: payload.is_staff ?? false,
    must_change_password: payload.must_change_password ?? false,
    onboarding: payload.onboarding,
    owner_name: payload.owner_name ?? null,
    permissions: payload.permissions ?? {},
  };
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "bn";
  return localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "bn";
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;

  if (!token) {
    localStorage.removeItem("auth_token");
    return;
  }

  localStorage.setItem("auth_token", token);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;

  if (!user) {
    localStorage.removeItem("auth_user");
    return;
  }

  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export function normalizeRole(user: AuthUser | null): "admin" | "user" | null {
  if (!user) return null;
  return user.role === "admin" ? "admin" : "user";
}

/**
 * Fetches an authenticated PDF (or any file) via Bearer token and opens it
 * in a new tab. Plain <a href> can't carry the Authorization header, so the
 * file has to be fetched as a blob first — used for invoice PDFs
 * (subscription payments, SMS credit purchases) and courier waybill labels.
 * Pass `init` (method/body) for POST-based bulk downloads.
 */
export async function openAuthenticatedPdf(url: string, init?: RequestInit): Promise<{ success: boolean; message?: string }> {
  const token = getStoredToken();
  if (!token) return { success: false, message: "Not authenticated." };

  try {
    const res = await fetch(url, {
      ...init,
      // The server sends Cache-Control: no-store on these too, but a
      // regenerated PDF (e.g. a font/layout fix) must never be masked by
      // a stale cached response for the same URL — belt and suspenders.
      cache: "no-store",
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let message: string | undefined;
      try {
        message = ((await res.json()) as { message?: string })?.message;
      } catch {
        // response wasn't JSON (e.g. the PDF itself on success, or an HTML error page)
      }
      return { success: false, message };
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank");
    // Revoke after a delay — the new tab needs the URL to still be valid when it loads.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { success: true };
  } catch {
    return { success: false };
  }
}
