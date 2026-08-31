/**
 * Shared metadata for the 7 merchant-gateway providers (SSLCommerz,
 * AamarPay, ZiniPay, ShurjoPay, EPS, bKash Merchant, Nagad Merchant) — used
 * by both the seller-facing checkout gateway picker and (new) the
 * platform-payment-gateway admin settings page + the seller-facing
 * "pay the platform" picker. See online_payment_context.md §12.
 *
 * Colors/labels intentionally match dashboard/settings/payments/page.tsx's
 * own GATEWAY_PROVIDERS constant for visual consistency across the two
 * (seller checkout vs platform billing) settings screens — kept as a
 * separate small constant here rather than importing that page's array,
 * since that one is scoped to a "use client" page component, not a
 * reusable lib export.
 */

export interface GatewayFieldSchema {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
}

export interface GatewayProviderMeta {
  provider: string;
  label: string;
  badgeColor: string;
  badgeBg: string;
  description: { bn: string; en: string };
  fields: GatewayFieldSchema[];
}

export const GATEWAY_PROVIDER_META: GatewayProviderMeta[] = [
  {
    provider: "sslcommerz",
    label: "SSLCommerz",
    badgeColor: "text-blue-400",
    badgeBg: "bg-blue-500/10 border-blue-500/20",
    description: {
      bn: "বাংলাদেশের জনপ্রিয় পেমেন্ট গেটওয়ে — কার্ড, ইন্টারনেট ব্যাংকিং ও মোবাইল ওয়ালেট সাপোর্ট।",
      en: "Popular Bangladesh payment gateway supporting cards, internet banking & mobile wallets.",
    },
    fields: [
      { key: "store_id", label: "Store ID", type: "text", placeholder: "e.g. yourshoplive" },
      { key: "store_password", label: "Store Password", type: "password", placeholder: "e.g. your_store_passwd" },
    ],
  },
  {
    provider: "aamarpay",
    label: "AamarPay",
    badgeColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20",
    description: {
      bn: "সহজ ও দ্রুত পেমেন্ট গেটওয়ে — বিকাশ, নগদ, রকেট, উপায় এবং কার্ড পেমেন্ট সাপোর্ট।",
      en: "Fast checkout payment gateway supporting bKash, Nagad, Rocket, Upay & cards.",
    },
    fields: [
      { key: "store_id", label: "Store ID", type: "text", placeholder: "e.g. aamarpaytest" },
      { key: "signature_key", label: "Signature Key", type: "password", placeholder: "e.g. dbb74894e824..." },
    ],
  },
  {
    provider: "zinipay",
    label: "ZiniPay",
    badgeColor: "text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
    description: {
      bn: "মোবাইল ফিনান্সিয়াল সার্ভিসেস (MFS) ভিত্তিক অ্যাগ্রিগেটর গেটওয়ে।",
      en: "Mobile financial services aggregator gateway for local wallets.",
    },
    fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "e.g. zini_live_key_..." }],
  },
  {
    provider: "shurjopay",
    label: "ShurjoPay",
    badgeColor: "text-orange-400",
    badgeBg: "bg-orange-500/10 border-orange-500/20",
    description: {
      bn: "বাংলাদেশ ব্যাংক অনুমোদিত পেমেন্ট গেটওয়ে — কার্ড, নেট ব্যাংকিং ও মোবাইল ওয়ালেট সাপোর্ট।",
      en: "Bangladesh Bank licensed payment gateway supporting cards, net banking & mobile wallets.",
    },
    fields: [
      { key: "username", label: "Merchant Username", type: "text", placeholder: "e.g. your_merchant_username" },
      { key: "password", label: "Merchant Password", type: "password", placeholder: "e.g. your_merchant_password" },
      { key: "prefix", label: "Store Prefix", type: "text", placeholder: "e.g. NOK or SP" },
    ],
  },
  {
    provider: "eps",
    label: "EPS",
    badgeColor: "text-cyan-400",
    badgeBg: "bg-cyan-500/10 border-cyan-500/20",
    description: {
      bn: "বিকাশ, নগদ, রকেট, কার্ড ও ব্যাংক ট্রান্সফার — সবগুলো একসাথে সাপোর্ট করা অ্যাগ্রিগেটর গেটওয়ে।",
      en: "Aggregator gateway supporting bKash, Nagad, Rocket, cards & bank transfers in one integration.",
    },
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", placeholder: "e.g. 29e86e70-0ac6-..." },
      { key: "store_id", label: "Store ID", type: "text", placeholder: "e.g. d44e705f-9e3a-..." },
      { key: "username", label: "Username", type: "text", placeholder: "e.g. your_eps_username" },
      { key: "password", label: "Password", type: "password", placeholder: "e.g. your_eps_password" },
      { key: "hash_key", label: "Hash Key", type: "password", placeholder: "e.g. your_eps_hash_key" },
    ],
  },
  {
    provider: "bkash_merchant",
    label: "bKash (Merchant)",
    badgeColor: "text-pink-400",
    badgeBg: "bg-pink-500/10 border-pink-500/20",
    description: {
      bn: "বিকাশ মার্চেন্ট টোকেনাইজড চেকআউট — সেলার সরাসরি বিকাশ অ্যাপ/ওয়েবসাইটে পে করে অটো-কনফার্ম।",
      en: "bKash merchant tokenized checkout — auto-confirmed on payment.",
    },
    fields: [
      { key: "app_key", label: "App Key", type: "text", placeholder: "e.g. your_bkash_app_key" },
      { key: "app_secret", label: "App Secret", type: "password", placeholder: "e.g. your_bkash_app_secret" },
      { key: "username", label: "Username", type: "text", placeholder: "e.g. your_bkash_username" },
      { key: "password", label: "Password", type: "password", placeholder: "e.g. your_bkash_password" },
    ],
  },
  {
    provider: "nagad_merchant",
    label: "Nagad (Merchant)",
    badgeColor: "text-rose-400",
    badgeBg: "bg-rose-500/10 border-rose-500/20",
    description: {
      bn: "নগদ মার্চেন্ট চেকআউট — RSA কি-পেয়ার লাগে (Nagad মার্চেন্ট প্যানেল থেকে Key Generate করে নিন)।",
      en: "Nagad merchant checkout — requires an RSA key pair (generate from your Nagad merchant panel).",
    },
    fields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", placeholder: "e.g. your_nagad_merchant_id" },
      { key: "account_number", label: "Merchant Account Number", type: "text", placeholder: "e.g. 01700000000" },
      { key: "merchant_private_key", label: "Merchant Private Key (শুধু base64 body)", type: "password", placeholder: "MIIEvQ..." },
      { key: "pg_public_key", label: "Nagad PG Public Key (শুধু base64 body)", type: "password", placeholder: "MIIBIjAN..." },
    ],
  },
];

export function gatewayProviderMeta(provider: string): GatewayProviderMeta | undefined {
  return GATEWAY_PROVIDER_META.find((p) => p.provider === provider);
}
