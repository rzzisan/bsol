"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

type ValidityUnit = "day" | "month";
type UserStatus = "pending" | "active" | "inactive" | "expired" | "left";

interface SubscriptionPackage {
  id: number;
  name: string;
  slug: string;
  price: string;
  duration_days: number;
  max_orders: number | null;
  max_landing_pages: number | null;
  max_tracking_events_per_day: number | null;
  max_staff: number | null;
  features: string[] | null;
  feature_flags: Record<string, boolean> | null;
  is_active: boolean;
  created_at: string;
}

interface PackageForm {
  name: string;
  max_orders: string;
  max_landing_pages: string;
  max_tracking_events_per_day: string;
  max_staff: string;
  // One bullet per line — matches exactly how dashboard/settings/subscription
  // renders package.features to a seller (each array entry as its own <li>,
  // no translation/key lookup), so a plain line-per-item textarea round-trips
  // without any hidden mapping to get wrong.
  features_text: string;
  price: string;
  validity_value: string;
  validity_unit: ValidityUnit;
  feature_storefront: boolean;
  feature_facebook: boolean;
}

interface EditPackageForm extends PackageForm {
  is_active: boolean;
}

interface RegistrationDefaults {
  default_user_status: UserStatus;
  default_subscription_package_id: number | null;
}

const EMPTY_FORM: PackageForm = {
  name: "",
  max_orders: "",
  max_landing_pages: "",
  max_tracking_events_per_day: "",
  max_staff: "",
  features_text: "",
  price: "",
  validity_value: "1",
  validity_unit: "month",
  // Default-allow, matches backend EnsurePackageFeature — a package that's
  // never had these touched stays fully open; admin unchecks to restrict.
  feature_storefront: true,
  feature_facebook: true,
};

const EMPTY_DEFAULTS: RegistrationDefaults = {
  default_user_status: "pending",
  default_subscription_package_id: null,
};

const text = {
  bn: {
    title: "প্যাকেজ ম্যানেজমেন্ট",
    subtitle: "গ্রাহকদের জন্য নতুন সাবস্ক্রিপশন প্যাকেজ তৈরি করুন।",
    loginRequired: "এই পেজ দেখতে হলে অ্যাডমিন হিসেবে লগইন করুন।",
    accessDenied: "শুধুমাত্র অ্যাডমিন এই পেজ দেখতে পারবেন।",
    goHome: "হোমে যান",
    backToAdmin: "অ্যাডমিন ড্যাশবোর্ড",
    menuDashboard: "ড্যাশবোর্ড",
    menuCustomers: "গ্রাহক",
    menuActive: "অ্যাকটিভ গ্রাহক",
    menuPending: "পেন্ডিং গ্রাহক",
    menuSms: "এসএমএস",
    menuSmsGateway: "এসএমএস গেটওয়ে",
    menuSmsSend: "এসএমএস সেন্ড",
    menuSmsHistory: "এসএমএস হিস্টোরি",
    menuSmsCredit: "এসএমএস ক্রেডিট",
    menuPackages: "প্যাকেজ",
    menuBilling: "বিলিং",
    menuReports: "রিপোর্ট",
    menuSettings: "সেটিংস",
    menuEmailSettings: "ইমেইল সেটিংস",
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    createTitle: "নতুন প্যাকেজ তৈরি",
    defaultsTitle: "ডিফল্ট রেজিস্ট্রেশন সেটিংস",
    defaultsDescription:
      "নতুন ইউজার রেজিস্ট্রেশন সম্পন্ন হলে কোন Status এবং Package পাবে তা নির্ধারণ করুন।",
    listTitle: "প্যাকেজ তালিকা",
    loading: "লোড হচ্ছে...",
    empty: "এখনও কোনো প্যাকেজ নেই।",
    form: {
      name: "প্যাকেজ নাম",
      maxOrders: "সর্বোচ্চ অর্ডার লিমিট",
      maxOrdersHint: "ফাঁকা রাখলে আনলিমিটেড ধরা হবে",
      maxLandingPages: "সর্বোচ্চ ল্যান্ডিং পেজ",
      maxLandingPagesHint: "ফাঁকা রাখলে আনলিমিটেড ধরা হবে",
      maxTrackingEvents: "দৈনিক ট্র্যাকিং ইভেন্ট লিমিট",
      maxTrackingEventsHint: "ফাঁকা = আনলিমিটেড, 0 = এই প্যাকেজে ট্র্যাকিং নেই",
      maxStaff: "সর্বোচ্চ স্টাফ সংখ্যা",
      maxStaffHint: "ফাঁকা রাখলে আনলিমিটেড ধরা হবে",
      featuresText: "ফিচার বুলেট লিস্ট (সেলার upgrade পেজে দেখবে)",
      featuresTextHint: "প্রতি লাইনে একটা ফিচার লিখুন",
      featureFlagsTitle: "মডিউল অ্যাক্সেস",
      featureStorefront: "স্টোরফ্রন্ট",
      featureFacebook: "ফেসবুক ট্র্যাকিং + লিডস",
      price: "মূল্য (BDT)",
      validity: "ভ্যালিডিটি",
      defaultStatus: "ডিফল্ট ইউজার স্ট্যাটাস",
      defaultPackage: "ডিফল্ট প্যাকেজ",
      noDefaultPackage: "-- কোনো প্যাকেজ নয় --",
      saveDefaults: "ডিফল্ট সেটিংস সংরক্ষণ করুন",
      savingDefaults: "সংরক্ষণ হচ্ছে...",
      validityValue: "মান",
      validityUnit: "ইউনিট",
      unitDay: "দিন",
      unitMonth: "মাস",
      save: "প্যাকেজ তৈরি করুন",
      saving: "তৈরি হচ্ছে...",
    },
    table: {
      name: "নাম",
      maxOrders: "ম্যাক্স অর্ডার",
      maxLandingPages: "ম্যাক্স ল্যান্ডিং পেজ",
      maxTrackingEvents: "ট্র্যাকিং/দিন",
      maxStaff: "ম্যাক্স স্টাফ",
      price: "মূল্য",
      validity: "ভ্যালিডিটি",
      status: "স্ট্যাটাস",
      createdAt: "তৈরির তারিখ",
      actions: "অ্যাকশন",
    },
    editTitle: "প্যাকেজ সম্পাদনা",
    editSave: "পরিবর্তন সংরক্ষণ করুন",
    editSaving: "সংরক্ষণ হচ্ছে...",
    editBtn: "সম্পাদনা",
    deleteBtn: "মুছুন",
    deleteConfirmTitle: "প্যাকেজ মুছবেন?",
    deleteConfirmMsg: "এই প্যাকেজটি স্থায়ীভাবে মুছে যাবে। নিশ্চিত?",
    deleteConfirm: "হ্যাঁ, মুছুন",
    deleteCancel: "বাতিল",
    deleting: "মুছছে...",
    editFailed: "প্যাকেজ আপডেট করা যায়নি।",
    deleteFailed: "প্যাকেজ মুছতে ব্যর্থ হয়েছে।",
    edited: "প্যাকেজ সফলভাবে আপডেট হয়েছে।",
    deleted: "প্যাকেজ মুছে ফেলা হয়েছে।",
    activeLabel: "সক্রিয়",
    statusActive: "Active",
    statusInactive: "Inactive",
    statuses: {
      pending: "Pending",
      active: "Active",
      inactive: "In-Active",
      expired: "Expired",
      left: "Left",
    },
    validation: {
      required: "অনুগ্রহ করে সব প্রয়োজনীয় তথ্য দিন।",
      validityInvalid: "ভ্যালিডিটি ১ বা তার বেশি হতে হবে।",
      priceInvalid: "মূল্য ০ বা তার বেশি হতে হবে।",
      maxOrderInvalid: "অর্ডার লিমিট ০ বা তার বেশি হতে হবে।",
      maxLandingPagesInvalid: "ল্যান্ডিং পেজ লিমিট ০ বা তার বেশি হতে হবে।",
      maxTrackingEventsInvalid: "ট্র্যাকিং ইভেন্ট লিমিট ০ বা তার বেশি হতে হবে।",
      maxStaffInvalid: "স্টাফ সংখ্যা ০ বা তার বেশি হতে হবে।",
    },
    created: "প্যাকেজ সফলভাবে তৈরি হয়েছে।",
    defaultsSaved: "ডিফল্ট রেজিস্ট্রেশন সেটিংস সংরক্ষণ হয়েছে।",
    failed: "প্যাকেজ তৈরি করা যায়নি।",
    defaultsFailed: "ডিফল্ট সেটিংস সংরক্ষণ করা যায়নি।",
    deletedPackageWarning: "পূর্বে নির্বাচিত ডিফল্ট প্যাকেজটি মুছে ফেলা হয়েছে এবং ডিফল্ট সেটিং রিসেট করা হয়েছে।",
    unlimited: "Unlimited",
    dayWord: "দিন",
    daysWord: "দিন",
    monthWord: "মাস",
    monthsWord: "মাস",
  },
  en: {
    title: "Package Management",
    subtitle: "Create new subscription packages for your users.",
    loginRequired: "Please login as admin to access this page.",
    accessDenied: "Only admin users can view this page.",
    goHome: "Go Home",
    backToAdmin: "Admin Dashboard",
    menuDashboard: "Dashboard",
    menuCustomers: "Customers",
    menuActive: "Active Customers",
    menuPending: "Pending Customers",
    menuSms: "SMS",
    menuSmsGateway: "SMS Gateway",
    menuSmsSend: "Send SMS",
    menuSmsHistory: "SMS History",
    menuSmsCredit: "SMS Credit",
    menuPackages: "Packages",
    menuBilling: "Billing",
    menuReports: "Reports",
    menuSettings: "Settings",
    menuEmailSettings: "Email Settings",
    languageLabel: "Language",
    themeLabel: "Theme",
    createTitle: "Create New Package",
    defaultsTitle: "Default Registration Settings",
    defaultsDescription:
      "Choose which status and package newly registered users should receive right after registration.",
    listTitle: "Package List",
    loading: "Loading...",
    empty: "No packages found yet.",
    form: {
      name: "Package Name",
      maxOrders: "Maximum Order Limit",
      maxOrdersHint: "Leave empty to treat as unlimited",
      maxLandingPages: "Maximum Landing Pages",
      maxLandingPagesHint: "Leave empty to treat as unlimited",
      maxTrackingEvents: "Daily Tracking Event Limit",
      maxTrackingEventsHint: "Empty = unlimited, 0 = tracking not included",
      maxStaff: "Maximum Staff Seats",
      maxStaffHint: "Leave empty to treat as unlimited",
      featuresText: "Feature bullet list (shown to sellers on the upgrade page)",
      featuresTextHint: "One feature per line",
      featureFlagsTitle: "Module Access",
      featureStorefront: "Storefront",
      featureFacebook: "FB Tracking + Leads",
      price: "Price (BDT)",
      validity: "Validity",
      defaultStatus: "Default User Status",
      defaultPackage: "Default Package",
      noDefaultPackage: "-- No package --",
      saveDefaults: "Save Default Settings",
      savingDefaults: "Saving...",
      validityValue: "Value",
      validityUnit: "Unit",
      unitDay: "Day",
      unitMonth: "Month",
      save: "Create Package",
      saving: "Creating...",
    },
    table: {
      name: "Name",
      maxOrders: "Max Orders",
      maxLandingPages: "Max Landing Pages",
      maxTrackingEvents: "Tracking/Day",
      maxStaff: "Max Staff",
      price: "Price",
      validity: "Validity",
      status: "Status",
      createdAt: "Created At",
      actions: "Actions",
    },
    editTitle: "Edit Package",
    editSave: "Save Changes",
    editSaving: "Saving...",
    editBtn: "Edit",
    deleteBtn: "Delete",
    deleteConfirmTitle: "Delete Package?",
    deleteConfirmMsg: "This package will be permanently deleted. Are you sure?",
    deleteConfirm: "Yes, Delete",
    deleteCancel: "Cancel",
    deleting: "Deleting...",
    editFailed: "Failed to update package.",
    deleteFailed: "Failed to delete package.",
    edited: "Package updated successfully.",
    deleted: "Package deleted successfully.",
    activeLabel: "Active",
    statusActive: "Active",
    statusInactive: "Inactive",
    statuses: {
      pending: "Pending",
      active: "Active",
      inactive: "In-Active",
      expired: "Expired",
      left: "Left",
    },
    validation: {
      required: "Please fill all required fields.",
      validityInvalid: "Validity must be 1 or greater.",
      priceInvalid: "Price must be 0 or greater.",
      maxOrderInvalid: "Max order limit must be 0 or greater.",
      maxLandingPagesInvalid: "Max landing pages must be 0 or greater.",
      maxTrackingEventsInvalid: "Tracking event limit must be 0 or greater.",
      maxStaffInvalid: "Max staff must be 0 or greater.",
    },
    created: "Package created successfully.",
    defaultsSaved: "Default registration settings saved.",
    failed: "Failed to create package.",
    defaultsFailed: "Failed to save default settings.",
    deletedPackageWarning: "The previously selected default package no longer exists and has been cleared.",
    unlimited: "Unlimited",
    dayWord: "day",
    daysWord: "days",
    monthWord: "month",
    monthsWord: "months",
  },
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";

export default function AdminPackagesPage() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [state, setState] = useState<
    "loading" | "unauthenticated" | "forbidden" | "ready"
  >("loading");

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [defaults, setDefaults] = useState<RegistrationDefaults>(EMPTY_DEFAULTS);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "warn"; text: string } | null>(null);

  // Edit state
  const [editPkg, setEditPkg] = useState<SubscriptionPackage | null>(null);
  const [editForm, setEditForm] = useState<EditPackageForm>({ ...EMPTY_FORM, is_active: true });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deletePkg, setDeletePkg] = useState<SubscriptionPackage | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (!token || !storedUser) {
      setState("unauthenticated");
      return;
    }
    if (normalizeRole(storedUser) !== "admin") {
      setState("forbidden");
      return;
    }
    setState("ready");
  }, []);

  const t = useMemo(() => text[locale], [locale]);

  const menu = useMemo(
    () =>
      buildAdminMenu(locale),
    [t],
  );

  const loadPackages = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    setLoadingPackages(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/packages`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as { packages?: SubscriptionPackage[] };
      if (res.ok) {
        setPackages(data.packages ?? []);
      }
    } catch {
      setMessage({ type: "err", text: t.failed });
    } finally {
      setLoadingPackages(false);
    }
  }, [t.failed]);

  useEffect(() => {
    if (state === "ready") void loadPackages();
  }, [state, loadPackages]);

  const loadDefaults = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/registration-defaults`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as {
        defaults?: RegistrationDefaults;
      };

      if (res.ok && data.defaults) {
        setDefaults({
          default_user_status: data.defaults.default_user_status,
          default_subscription_package_id:
            data.defaults.default_subscription_package_id,
        });
      }
    } catch {
      setMessage({ type: "err", text: t.defaultsFailed });
    }
  }, [t.defaultsFailed]);

  useEffect(() => {
    if (state === "ready") {
      void loadDefaults();
    }
  }, [state, loadDefaults]);

  // Cross-check: if the stored default package was deleted, warn and clear it
  useEffect(() => {
    if (loadingPackages) return;
    const pkgId = defaults.default_subscription_package_id;
    if (pkgId === null || pkgId === undefined) return;
    const exists = packages.some((p) => p.id === pkgId);
    if (!exists) {
      setDefaults((prev) => ({ ...prev, default_subscription_package_id: null }));
      setMessage({ type: "warn", text: t.deletedPackageWarning });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPackages, packages]);

  function setField<K extends keyof PackageForm>(key: K, value: PackageForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validityToDays(value: number, unit: ValidityUnit): number {
    return unit === "month" ? value * 30 : value;
  }

  function formatValidity(durationDays: number): string {
    if (durationDays % 30 === 0) {
      const months = durationDays / 30;
      if (locale === "bn") return `${months} ${months > 1 ? t.monthsWord : t.monthWord}`;
      return `${months} ${months > 1 ? t.monthsWord : t.monthWord}`;
    }
    if (locale === "bn") return `${durationDays} ${t.daysWord}`;
    return `${durationDays} ${durationDays > 1 ? t.daysWord : t.dayWord}`;
  }

  async function handleCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!form.name.trim() || !form.price.trim() || !form.validity_value.trim()) {
      setMessage({ type: "err", text: t.validation.required });
      return;
    }

    const validityValue = Number(form.validity_value);
    const priceValue = Number(form.price);
    const maxOrdersValue = form.max_orders.trim() ? Number(form.max_orders) : null;
    const maxLandingPagesValue = form.max_landing_pages.trim() ? Number(form.max_landing_pages) : null;
    const maxTrackingValue = form.max_tracking_events_per_day.trim()
      ? Number(form.max_tracking_events_per_day)
      : null;
    const maxStaffValue = form.max_staff.trim() ? Number(form.max_staff) : null;
    const featuresValue = form.features_text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!Number.isFinite(validityValue) || validityValue < 1) {
      setMessage({ type: "err", text: t.validation.validityInvalid });
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setMessage({ type: "err", text: t.validation.priceInvalid });
      return;
    }

    if (
      maxOrdersValue !== null &&
      (!Number.isFinite(maxOrdersValue) || maxOrdersValue < 0)
    ) {
      setMessage({ type: "err", text: t.validation.maxOrderInvalid });
      return;
    }

    if (
      maxLandingPagesValue !== null &&
      (!Number.isFinite(maxLandingPagesValue) || maxLandingPagesValue < 0)
    ) {
      setMessage({ type: "err", text: t.validation.maxLandingPagesInvalid });
      return;
    }

    if (
      maxTrackingValue !== null &&
      (!Number.isFinite(maxTrackingValue) || maxTrackingValue < 0)
    ) {
      setMessage({ type: "err", text: t.validation.maxTrackingEventsInvalid });
      return;
    }

    if (maxStaffValue !== null && (!Number.isFinite(maxStaffValue) || maxStaffValue < 0)) {
      setMessage({ type: "err", text: t.validation.maxStaffInvalid });
      return;
    }

    const token = getStoredToken();
    if (!token) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/packages`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          price: priceValue,
          max_orders: maxOrdersValue,
          max_landing_pages: maxLandingPagesValue,
          max_tracking_events_per_day: maxTrackingValue,
          max_staff: maxStaffValue,
          features: featuresValue,
          duration_days: validityToDays(validityValue, form.validity_unit),
          feature_flags: { storefront: form.feature_storefront, facebook: form.feature_facebook },
          is_active: true,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!res.ok) {
        const msg = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data.message ?? t.failed);
        setMessage({ type: "err", text: msg });
        return;
      }

      setMessage({ type: "ok", text: data.message ?? t.created });
      setForm(EMPTY_FORM);
      void loadPackages();
    } catch {
      setMessage({ type: "err", text: t.failed });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDefaults(e: React.FormEvent) {
    e.preventDefault();

    const token = getStoredToken();
    if (!token) return;

    setSavingDefaults(true);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/registration-defaults`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          default_user_status: defaults.default_user_status,
          default_subscription_package_id: defaults.default_subscription_package_id,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!res.ok) {
        const msg = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data.message ?? t.defaultsFailed);
        setMessage({ type: "err", text: msg });
        return;
      }

      setMessage({ type: "ok", text: data.message ?? t.defaultsSaved });
    } catch {
      setMessage({ type: "err", text: t.defaultsFailed });
    } finally {
      setSavingDefaults(false);
    }
  }

  function openEditModal(pkg: SubscriptionPackage) {
    const days = pkg.duration_days;
    const isMonth = days % 30 === 0;
    setEditForm({
      name: pkg.name,
      max_orders: pkg.max_orders !== null ? String(pkg.max_orders) : "",
      max_landing_pages: pkg.max_landing_pages !== null ? String(pkg.max_landing_pages) : "",
      max_tracking_events_per_day:
        pkg.max_tracking_events_per_day !== null ? String(pkg.max_tracking_events_per_day) : "",
      max_staff: pkg.max_staff !== null ? String(pkg.max_staff) : "",
      features_text: (pkg.features ?? []).join("\n"),
      price: String(pkg.price),
      validity_value: isMonth ? String(days / 30) : String(days),
      validity_unit: isMonth ? "month" : "day",
      feature_storefront: pkg.feature_flags?.storefront ?? true,
      feature_facebook: pkg.feature_flags?.facebook ?? true,
      is_active: pkg.is_active,
    });
    setEditPkg(pkg);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editPkg) return;
    const name = editForm.name.trim();
    if (!name || !editForm.price || !editForm.validity_value) {
      setMessage({ type: "err", text: t.validation.required });
      return;
    }
    const validity = Number(editForm.validity_value);
    if (!Number.isFinite(validity) || validity < 1) {
      setMessage({ type: "err", text: t.validation.validityInvalid });
      return;
    }
    const price = Number(editForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setMessage({ type: "err", text: t.validation.priceInvalid });
      return;
    }
    const maxOrders = editForm.max_orders === "" ? null : Number(editForm.max_orders);
    if (maxOrders !== null && (!Number.isInteger(maxOrders) || maxOrders < 0)) {
      setMessage({ type: "err", text: t.validation.maxOrderInvalid });
      return;
    }
    const maxLandingPages = editForm.max_landing_pages === "" ? null : Number(editForm.max_landing_pages);
    if (maxLandingPages !== null && (!Number.isInteger(maxLandingPages) || maxLandingPages < 0)) {
      setMessage({ type: "err", text: t.validation.maxLandingPagesInvalid });
      return;
    }
    const maxTracking =
      editForm.max_tracking_events_per_day === ""
        ? null
        : Number(editForm.max_tracking_events_per_day);
    if (maxTracking !== null && (!Number.isInteger(maxTracking) || maxTracking < 0)) {
      setMessage({ type: "err", text: t.validation.maxTrackingEventsInvalid });
      return;
    }
    const maxStaff = editForm.max_staff === "" ? null : Number(editForm.max_staff);
    if (maxStaff !== null && (!Number.isInteger(maxStaff) || maxStaff < 0)) {
      setMessage({ type: "err", text: t.validation.maxStaffInvalid });
      return;
    }
    const features = editForm.features_text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const token = getStoredToken();
    if (!token) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/packages/${editPkg.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          price,
          duration_days: validityToDays(validity, editForm.validity_unit),
          max_orders: maxOrders,
          max_landing_pages: maxLandingPages,
          max_tracking_events_per_day: maxTracking,
          max_staff: maxStaff,
          features,
          feature_flags: { storefront: editForm.feature_storefront, facebook: editForm.feature_facebook },
          is_active: editForm.is_active,
        }),
      });
      const data = (await res.json()) as { message?: string; errors?: Record<string, string[]> };
      if (!res.ok) {
        const msg = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : (data.message ?? t.editFailed);
        setMessage({ type: "err", text: msg });
        return;
      }
      setMessage({ type: "ok", text: data.message ?? t.edited });
      setEditPkg(null);
      void loadPackages();
    } catch {
      setMessage({ type: "err", text: t.editFailed });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletePkg) return;
    const token = getStoredToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/packages/${deletePkg.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setMessage({ type: "err", text: data.message ?? t.deleteFailed });
        return;
      }
      setMessage({ type: "ok", text: data.message ?? t.deleted });
      setDeletePkg(null);
      void loadPackages();
    } catch {
      setMessage({ type: "err", text: t.deleteFailed });
    } finally {
      setDeleting(false);
    }
  }

  if (state !== "ready") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
            {t.title}
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">
            {state === "forbidden" ? t.accessDenied : t.loginRequired}
          </p>
          <a
            href="/"
            className="mt-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.goHome}
          </a>
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
      localeLabel={t.languageLabel}
      themeLabel={t.themeLabel}
      sidebarTitle="Admin Panel"
      userName={t.menuPackages}
      userMeta={t.backToAdmin}
      menu={menu}
      activeKey="packages"
      defaultExpandedKey="customers"
      onToggleLocale={() => setLocale(locale === "bn" ? "en" : "bn")}
      onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <section className="catv-panel mb-5 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{t.defaultsTitle}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.defaultsDescription}</p>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSaveDefaults}>
          <div>
            <label className={labelCls}>{t.form.defaultStatus}</label>
            <select
              className={inputCls}
              value={defaults.default_user_status}
              onChange={(e) =>
                setDefaults((prev) => ({
                  ...prev,
                  default_user_status: e.target.value as UserStatus,
                }))
              }
            >
              {(
                ["pending", "active", "inactive", "expired", "left"] as UserStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {t.statuses[status]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t.form.defaultPackage}</label>
            <select
              className={inputCls}
              value={
                defaults.default_subscription_package_id
                  ? String(defaults.default_subscription_package_id)
                  : ""
              }
              onChange={(e) =>
                setDefaults((prev) => ({
                  ...prev,
                  default_subscription_package_id: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
            >
              <option value="">{t.form.noDefaultPackage}</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={String(pkg.id)}>
                  {pkg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingDefaults}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-60"
            >
              {savingDefaults ? t.form.savingDefaults : t.form.saveDefaults}
            </button>
          </div>
        </form>
      </section>

      <section className="catv-panel mb-5 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{t.createTitle}</h2>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreatePackage}>
          <div>
            <label className={labelCls}>{t.form.name}</label>
            <input
              type="text"
              className={inputCls}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder={locale === "bn" ? "Starter / Pro / Plus" : "Starter / Pro / Plus"}
            />
          </div>

          <div>
            <label className={labelCls}>{t.form.maxOrders}</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.max_orders}
              onChange={(e) => setField("max_orders", e.target.value)}
              placeholder={locale === "bn" ? "যেমন: 100" : "e.g. 100"}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.maxOrdersHint}</p>
          </div>

          <div>
            <label className={labelCls}>{t.form.maxLandingPages}</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.max_landing_pages}
              onChange={(e) => setField("max_landing_pages", e.target.value)}
              placeholder={locale === "bn" ? "যেমন: 5" : "e.g. 5"}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.maxLandingPagesHint}</p>
          </div>

          <div>
            <label className={labelCls}>{t.form.maxTrackingEvents}</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.max_tracking_events_per_day}
              onChange={(e) => setField("max_tracking_events_per_day", e.target.value)}
              placeholder={locale === "bn" ? "যেমন: 5000" : "e.g. 5000"}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.maxTrackingEventsHint}</p>
          </div>

          <div>
            <label className={labelCls}>{t.form.maxStaff}</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.max_staff}
              onChange={(e) => setField("max_staff", e.target.value)}
              placeholder={locale === "bn" ? "যেমন: 3" : "e.g. 3"}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.maxStaffHint}</p>
          </div>

          <div>
            <label className={labelCls}>{t.form.price}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              placeholder={locale === "bn" ? "যেমন: 499" : "e.g. 499"}
            />
          </div>

          <div>
            <label className={labelCls}>{t.form.validity}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={form.validity_value}
                onChange={(e) => setField("validity_value", e.target.value)}
                placeholder={t.form.validityValue}
              />
              <select
                className={inputCls}
                value={form.validity_unit}
                onChange={(e) =>
                  setField("validity_unit", e.target.value as ValidityUnit)
                }
              >
                <option value="day">{t.form.unitDay}</option>
                <option value="month">{t.form.unitMonth}</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>{t.form.featuresText}</label>
            <textarea
              rows={5}
              className={inputCls}
              value={form.features_text}
              onChange={(e) => setField("features_text", e.target.value)}
              placeholder={locale === "bn" ? "অর্ডার ম্যানেজমেন্ট\nকুরিয়ার ইন্টিগ্রেশন\n..." : "Order management\nCourier integration\n..."}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{t.form.featuresTextHint}</p>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>{t.form.featureFlagsTitle}</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={form.feature_storefront}
                  onChange={(e) => setField("feature_storefront", e.target.checked)}
                />
                {t.form.featureStorefront}
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={form.feature_facebook}
                  onChange={(e) => setField("feature_facebook", e.target.checked)}
                />
                {t.form.featureFacebook}
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? t.form.saving : t.form.save}
            </button>
          </div>
        </form>

        {message && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : message.type === "warn"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className="catv-panel overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{t.listTitle}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#2f7ec1] text-white">
              <tr>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.name}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">{t.table.maxOrders}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">{t.table.maxLandingPages}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">{t.table.maxTrackingEvents}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">{t.table.maxStaff}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-right font-semibold">{t.table.price}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.validity}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.status}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left font-semibold">{t.table.createdAt}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-center font-semibold">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loadingPackages && (
                <tr>
                  <td colSpan={10} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {t.loading}
                  </td>
                </tr>
              )}

              {!loadingPackages && packages.length === 0 && (
                <tr>
                  <td colSpan={10} className="border border-[var(--border)] px-4 py-6 text-center text-[var(--muted)]">
                    {t.empty}
                  </td>
                </tr>
              )}

              {!loadingPackages &&
                packages.map((pkg) => (
                  <tr key={pkg.id} className="bg-[var(--surface)] even:bg-[var(--surface-soft)] hover:bg-[var(--accent)]/10">
                    <td className="border border-[var(--border)] px-3 py-2 font-medium text-[var(--foreground)]">{pkg.name}</td>
                    <td className="border border-[var(--border)] px-3 py-2 text-right">
                      {pkg.max_orders ?? t.unlimited}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-right">
                      {pkg.max_landing_pages ?? t.unlimited}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-right">
                      {pkg.max_tracking_events_per_day ?? t.unlimited}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-right">
                      {pkg.max_staff ?? t.unlimited}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-right">
                      BDT {Number(pkg.price).toFixed(2)}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2">{formatValidity(pkg.duration_days)}</td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          pkg.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {pkg.is_active ? t.statusActive : t.statusInactive}
                      </span>
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2">
                      {new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(new Date(pkg.created_at))}
                    </td>
                    <td className="border border-[var(--border)] px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(pkg)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
                        >
                          {t.editBtn}
                        </button>
                        <button
                          onClick={() => setDeletePkg(pkg)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          {t.deleteBtn}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Edit Package Modal ── */}
      {editPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
              {t.editTitle}: <span className="text-[var(--accent)]">{editPkg.name}</span>
            </h3>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEditSave}>
              <div className="md:col-span-2">
                <label className={labelCls}>{t.form.name}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.price}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={editForm.price}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.maxOrders}</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder={t.form.maxOrdersHint}
                  value={editForm.max_orders}
                  onChange={(e) => setEditForm((p) => ({ ...p, max_orders: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.maxLandingPages}</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder={t.form.maxLandingPagesHint}
                  value={editForm.max_landing_pages}
                  onChange={(e) => setEditForm((p) => ({ ...p, max_landing_pages: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.maxTrackingEvents}</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder={t.form.maxTrackingEventsHint}
                  value={editForm.max_tracking_events_per_day}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, max_tracking_events_per_day: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.maxStaff}</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder={t.form.maxStaffHint}
                  value={editForm.max_staff}
                  onChange={(e) => setEditForm((p) => ({ ...p, max_staff: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.validityValue}</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={editForm.validity_value}
                  onChange={(e) => setEditForm((p) => ({ ...p, validity_value: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>{t.form.validityUnit}</label>
                <select
                  className={inputCls}
                  value={editForm.validity_unit}
                  onChange={(e) => setEditForm((p) => ({ ...p, validity_unit: e.target.value as ValidityUnit }))}
                >
                  <option value="day">{t.form.unitDay}</option>
                  <option value="month">{t.form.unitMonth}</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{t.form.featuresText}</label>
                <textarea
                  rows={5}
                  className={inputCls}
                  value={editForm.features_text}
                  onChange={(e) => setEditForm((p) => ({ ...p, features_text: e.target.value }))}
                />
                <p className="mt-1 text-xs text-[var(--muted)]">{t.form.featuresTextHint}</p>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{t.form.featureFlagsTitle}</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      checked={editForm.feature_storefront}
                      onChange={(e) => setEditForm((p) => ({ ...p, feature_storefront: e.target.checked }))}
                    />
                    {t.form.featureStorefront}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      checked={editForm.feature_facebook}
                      onChange={(e) => setEditForm((p) => ({ ...p, feature_facebook: e.target.checked }))}
                    />
                    {t.form.featureFacebook}
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  id="edit-is-active"
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                <label htmlFor="edit-is-active" className="text-sm text-[var(--foreground)]">
                  {t.activeLabel}
                </label>
              </div>
              <div className="flex gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-60"
                >
                  {editSubmitting ? t.editSaving : t.editSave}
                </button>
                <button
                  type="button"
                  onClick={() => setEditPkg(null)}
                  className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                >
                  {t.deleteCancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletePkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">{t.deleteConfirmTitle}</h3>
            <p className="mb-5 text-sm text-[var(--muted)]">
              <strong>{deletePkg.name}</strong> — {t.deleteConfirmMsg}
            </p>
            <div className="flex gap-3">
              <button
                disabled={deleting}
                onClick={() => void handleDeleteConfirm()}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? t.deleting : t.deleteConfirm}
              </button>
              <button
                onClick={() => setDeletePkg(null)}
                className="rounded-lg border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)]"
              >
                {t.deleteCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </CatvShell>
  );
}
