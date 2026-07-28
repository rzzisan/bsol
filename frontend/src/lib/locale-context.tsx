"use client";

import { createContext, useContext } from "react";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

// UserShell provides the live, currently-toggled locale here so descendant
// pages/components can read it reactively (instant update on toggle,
// no navigation/reload needed) instead of each re-reading localStorage
// independently on their own mount — which is what caused the topbar/sidebar
// to switch instantly while page bodies stayed stale until a reload.
export const LocaleContext = createContext<Locale | null>(null);

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  return ctx ?? getStoredLocale();
}
