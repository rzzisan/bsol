"use client";

/**
 * Login/Register — UI placeholder only (seller_storefront_context.md §9,
 * §11 decision #1: customer accounts are a future feature, not this
 * phase). Clicking it says so instead of silently doing nothing.
 */
export default function AuthPlaceholderButton() {
  return (
    <button
      onClick={() => alert("কাস্টমার লগইন/রেজিস্ট্রেশন শীঘ্রই আসছে।")}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Login / Register
    </button>
  );
}
