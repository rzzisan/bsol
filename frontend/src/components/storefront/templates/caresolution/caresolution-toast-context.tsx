"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * A single bottom toast shared across every CaresolutionProductCard —
 * matches the reference's one "Product has been added to your cart."
 * banner instead of a per-card message. Rendered once in
 * CaresolutionShell; any card just calls showToast().
 */
type ToastContextValue = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function CaresolutionToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const showToast = useCallback((text: string) => setMessage(text), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm rounded-xl bg-gradient-to-r from-emerald-500 to-orange-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl sm:bottom-6">
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useCaresolutionToast(): ToastContextValue["showToast"] {
  const ctx = useContext(ToastContext);
  return ctx?.showToast ?? (() => {});
}
