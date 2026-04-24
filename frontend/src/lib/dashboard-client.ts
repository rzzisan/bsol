export type Locale = "bn" | "en";
export type ThemeMode = "dark" | "light";

export const LOCALE_STORAGE_KEY = "preferred_locale";
export const THEME_STORAGE_KEY = "preferred_theme";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
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

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function normalizeRole(user: AuthUser | null): "admin" | "user" | null {
  if (!user) return null;
  return user.role === "admin" ? "admin" : "user";
}
