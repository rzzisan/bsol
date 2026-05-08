"use client";

import { useEffect, useMemo, useState } from "react";
import CatvShell from "@/components/catv-shell";
import { buildAdminMenu } from "@/lib/admin-menu";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  normalizeRole,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

type Settings = {
  max_gallery_images: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
  min_width: number | null;
  min_height: number | null;
  max_width: number | null;
  max_height: number | null;
  thumbnail_required: boolean;
  is_active: boolean;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const labels = {
  bn: {
    title: "Product Media Settings",
    subtitle: "প্রডাক্ট ইমেজের সংখ্যা/সাইজ/ফরম্যাট নীতিমালা নিয়ন্ত্রণ করুন",
    loginRequired: "অ্যাডমিন হিসেবে লগইন করুন",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজে প্রবেশ করতে পারবেন",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    loaded: "সেটিংস লোড হয়েছে",
    updated: "সেটিংস আপডেট হয়েছে",
    goHome: "হোমে যান",
    menu: {
      dashboard: "ড্যাশবোর্ড",
      customers: "গ্রাহক",
      activeCustomers: "অ্যাকটিভ গ্রাহক",
      pendingCustomers: "পেন্ডিং গ্রাহক",
      sms: "এসএমএস",
      smsGateway: "এসএমএস গেটওয়ে",
      smsSend: "এসএমএস সেন্ড",
      smsHistory: "এসএমএস হিস্টোরি",
      smsCredit: "এসএমএস ক্রেডিট",
      packages: "প্যাকেজ",
      billing: "বিলিং",
      reports: "রিপোর্ট",
      settings: "সেটিংস",
      emailSettings: "ইমেইল সেটিংস",
      notificationTemplates: "নোটিফিকেশন টেমপ্লেট",
      notificationUseCases: "ইউজকেস ম্যাপিং",
      productMediaSettings: "Product Media",
    },
  },
  en: {
    title: "Product Media Settings",
    subtitle: "Control image count/size/format limits for products",
    loginRequired: "Please login as admin",
    accessDenied: "Only admins can access this page",
    save: "Save",
    saving: "Saving...",
    loaded: "Settings loaded",
    updated: "Settings updated",
    goHome: "Go Home",
    menu: {
      dashboard: "Dashboard",
      customers: "Customers",
      activeCustomers: "Active Customers",
      pendingCustomers: "Pending Customers",
      sms: "SMS",
      smsGateway: "SMS Gateway",
      smsSend: "Send SMS",
      smsHistory: "SMS History",
      smsCredit: "SMS Credit",
      packages: "Packages",
      billing: "Billing",
      reports: "Reports",
      settings: "Settings",
      emailSettings: "Email Settings",
      notificationTemplates: "Notification Templates",
      notificationUseCases: "Use-case Mapping",
      productMediaSettings: "Product Media",
    },
  },
};

export default function ProductMediaSettingsPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<"loading" | "unauthenticated" | "forbidden" | "ready">("loading");
  const [form, setForm] = useState<Settings>({
    max_gallery_images: 8,
    max_file_size_mb: 2,
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    min_width: null,
    min_height: null,
    max_width: null,
    max_height: null,
    thumbnail_required: true,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const t = useMemo(() => labels[locale], [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const token = getStoredToken();

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }

    setUser(storedUser);
    setState("ready");

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/admin/settings/product-media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          setForm((prev) => ({ ...prev, ...data.data }));
          setMessage(t.loaded);
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token, t.loaded]);

  const menus = useMemo(
    () =>
      buildAdminMenu({
        ...t.menu,
      }),
    [t],
  );

  const update = (k: keyof Settings, v: string | number | boolean | null | string[]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/settings/product-media`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "Update failed");
        return;
      }
      setMessage(t.updated);
      if (data?.data) setForm((prev) => ({ ...prev, ...data.data }));
    } finally {
      setLoading(false);
    }
  };

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold sm:text-2xl">{t.title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{state === "forbidden" ? t.accessDenied : t.loginRequired}</p>
          <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">{t.goHome}</a>
        </section>
      </main>
    );
  }

  return (
    <CatvShell
      title={t.title}
      subtitle={t.subtitle}
      locale={locale}
      theme={theme}
      localeLabel={locale === "bn" ? "ভাষা" : "Language"}
      themeLabel={locale === "bn" ? "থিম" : "Theme"}
      sidebarTitle={locale === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
      searchPlaceholder={locale === "bn" ? "সার্চ করুন" : "Search"}
      userName={user?.name}
      userMeta={user?.email}
      menu={menus}
      activeKey="settings-product-media"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel p-5">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.subtitle}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Max gallery images</span>
            <input type="number" min={1} max={20} value={form.max_gallery_images}
              onChange={(e) => update("max_gallery_images", Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Max file size (MB)</span>
            <input type="number" min={1} max={20} value={form.max_file_size_mb}
              onChange={(e) => update("max_file_size_mb", Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--muted)]">Allowed mime types (comma separated)</span>
            <input type="text" value={form.allowed_mime_types.join(",")}
              onChange={(e) => update("allowed_mime_types", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Min width</span>
            <input type="number" min={1} value={form.min_width ?? ""}
              onChange={(e) => update("min_width", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Min height</span>
            <input type="number" min={1} value={form.min_height ?? ""}
              onChange={(e) => update("min_height", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Max width</span>
            <input type="number" min={1} value={form.max_width ?? ""}
              onChange={(e) => update("max_width", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs text-[var(--muted)]">Max height</span>
            <input type="number" min={1} value={form.max_height ?? ""}
              onChange={(e) => update("max_height", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 text-sm">
            <input type="checkbox" checked={form.thumbnail_required} onChange={(e) => update("thumbnail_required", e.target.checked)} className="accent-[var(--accent)]" />
            Thumbnail required for active product
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={submit} disabled={loading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? t.saving : t.save}
          </button>
          {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        </div>
      </section>
    </CatvShell>
  );
}
