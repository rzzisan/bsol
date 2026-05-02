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
