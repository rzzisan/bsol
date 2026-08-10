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
 * (subscription payments, SMS credit purchases).
 */
export async function openAuthenticatedPdf(url: string): Promise<{ success: boolean; message?: string }> {
  const token = getStoredToken();
  if (!token) return { success: false, message: "Not authenticated." };

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
