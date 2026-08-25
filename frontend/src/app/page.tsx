"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Languages,
  LineChart,
  MessageCircle,
  Moon,
  ShieldAlert,
  ShoppingBag,
  Store,
  Sun,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  getStoredLocale,
  getStoredTheme,
  getStoredToken,
  getStoredUser,
  LOCALE_STORAGE_KEY,
  mergeAuthPayload,
  THEME_STORAGE_KEY,
  type AuthUser,
  type Locale,
  type ThemeMode,
} from "@/lib/dashboard-client";
import MetaPixelScript from "@/components/meta-pixel-script";

type AuthTab = "login" | "register";

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

// ---------------------------------------------------------------------------
// Ad attribution (platform_marketing_tracking_context.md) — first-touch
// UTM/click-id capture for BSOL's own acquisition funnel. Written once per
// browser (never overwritten by a later visit) and read back into the
// registration request so a signup — and later a paid conversion — can be
// attributed to the ad that actually brought the person in.
// ---------------------------------------------------------------------------
const ATTRIBUTION_STORAGE_KEY = "bsol_attribution";

function captureAttribution() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return; // first touch only

  const params = new URLSearchParams(window.location.search);
  const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
  const captured: Record<string, string> = {};
  for (const field of fields) {
    const value = params.get(field);
    if (value) captured[field] = value;
  }

  if (Object.keys(captured).length === 0) return; // nothing to remember — organic visit
  captured.landing_path = window.location.pathname;
  localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(captured));
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readAttributionForRegister(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  const attribution: Record<string, string> = stored ? JSON.parse(stored) : {};

  // Meta's Pixel writes these cookies itself once loaded — prefer them over
  // anything captured manually, they're the source of truth for fbp/fbc.
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");
  if (fbp) attribution.fbp = fbp;
  if (fbc) attribution.fbc = fbc;

  return attribution;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
const content = {
  bn: {
    brandName: "Zyrotech BSOL",
    nav: { features: "ফিচার", how: "কীভাবে কাজ করে", payments: "পেমেন্ট", login: "লগইন", signup: "ফ্রি অ্যাকাউন্ট" },
    badge: "বাংলাদেশের F-commerce ব্যবসার জন্য অল-ইন-ওয়ান প্ল্যাটফর্ম",
    title: "অর্ডার থেকে প্রফিট — আপনার পুরো ব্যবসা এক ড্যাশবোর্ডে",
    subtitle:
      "অর্ডার, ৫টি কুরিয়ার, ফেইক-অর্ডার প্রোটেকশন, ৭টি পেমেন্ট গেটওয়ে, ফেসবুক/হোয়াটসঅ্যাপ/SMS মার্কেটিং, স্টোরফ্রন্ট আর রিয়েল প্রফিট ট্র্যাকিং — সব একসাথে। স্প্রেডশিট আর একাধিক অ্যাপের ঝামেলা ছাড়াই ব্যবসা চালান।",
    heroHighlights: [
      "সেটআপ শুরু করতে কোনো কার্ড লাগে না",
      "বাংলা ও ইংরেজি — দুই ভাষাতেই সম্পূর্ণ সাপোর্ট",
      "মোবাইল থেকেই পুরো ব্যবসা নিয়ন্ত্রণ করুন",
    ],
    ctaPrimary: "ফ্রি অ্যাকাউন্ট খুলুন",
    ctaSecondary: "সব ফিচার দেখুন",
    statStrip: [
      { label: "কুরিয়ার পার্টনার", value: "৫+" },
      { label: "পেমেন্ট গেটওয়ে", value: "৭+" },
      { label: "কোর ফিচার মডিউল", value: "১৫+" },
      { label: "ড্যাশবোর্ড অ্যাক্সেস", value: "২৪/৭" },
    ],

    problemsTitle: "যে সমস্যাগুলো প্রতিদিন আপনার সময় ও টাকা নষ্ট করছে",
    problemsDescription: "F-commerce ব্যবসায় এই চ্যালেঞ্জগুলো পরিচিত? BSOL প্রতিটার জন্য একটা সরাসরি সমাধান দেয়।",
    problems: [
      {
        problem: "ফেইক/প্র্যাংক অর্ডারে কুরিয়ার খরচ ও সময় নষ্ট হয়",
        solution: "৫টা কুরিয়ারের রিটার্ন-হিস্টোরি একসাথে চেক করে ঝুঁকিপূর্ণ অর্ডার আগেই ধরে ফেলুন",
      },
      {
        problem: "একাধিক কুরিয়ার আর স্প্রেডশিটে অর্ডার ট্র্যাক করা কঠিন",
        solution: "সব অর্ডার, সব কুরিয়ারের স্ট্যাটাস — এক ড্যাশবোর্ড থেকে বুকিং, ট্র্যাকিং, ওয়েবিল",
      },
      {
        problem: "বিজ্ঞাপনের টাকায় আসলে কতটা লাভ হচ্ছে বোঝা যায় না",
        solution: "অ্যাড স্পেন্ড, প্রোডাক্ট কস্ট, ডেলিভারি চার্জ মিলিয়ে রিয়েল নেট প্রফিট দেখুন",
      },
      {
        problem: "মেসেঞ্জার/হোয়াটসঅ্যাপে কাস্টমার মেসেজ মিস হয়ে সেল হারানো",
        solution: "লিড ইনবক্স + হোয়াটসঅ্যাপ/SMS অটোমেশন দিয়ে কখনো ফলো-আপ মিস হবে না",
      },
    ],

    sectionTitle: "আপনার ব্যবসার জন্য যা যা লাগবে — সব এখানে আছে",
    sectionDescription: "প্রতিটা মডিউল বাস্তব দিনের-পর-দিনের অপারেশনের কথা মাথায় রেখে তৈরি — যাতে ব্যবসা চালানো সহজ হয়, জটিল না।",

    paymentsTitle: "যেসব পেমেন্ট গেটওয়ে সাপোর্ট করে",
    paymentsDescription: "মার্চেন্ট অ্যাকাউন্ট থাকলে অটোমেটেড গেটওয়ে, না থাকলে পার্সোনাল নম্বরেই সেন্ড-অ্যান্ড-ভেরিফাই — দুই পথই খোলা।",
    payments: ["SSLCommerz", "bKash", "Nagad", "AamarPay", "ZiniPay", "ShurjoPay", "EPS"],
    paymentsWalletNote: "মার্চেন্ট অ্যাকাউন্ট ছাড়াই — পার্সোনাল bKash / Nagad / Rocket নম্বরে সেন্ড মানি করেও কাস্টমার পেমেন্ট করতে পারবে",

    couriersTitle: "কুরিয়ার পার্টনার",
    couriers: ["Pathao", "Steadfast", "RedX", "Carrybee", "Paperfly"],

    benefitsTitle: "কেন ব্যবসায়ীরা BSOL বেছে নেবেন",
    benefitsDescription: "একটা শক্ত ফাউন্ডেশনের উপর তৈরি — ব্যবসায় স্বচ্ছতা আনে, সময় বাঁচায়, আর প্রতিটা সিদ্ধান্ত ডেটা দিয়ে নিতে সাহায্য করে।",
    readyItems: [
      { title: "ব্যবসায় সম্পূর্ণ স্বচ্ছতা", detail: "প্রতিটা অর্ডারের real profit/loss, কে কী পরিবর্তন করলো — সবকিছুর হিসাব রাখা।" },
      { title: "প্রতিদিন সময় বাঁচায়", detail: "ম্যানুয়াল কুরিয়ার এন্ট্রি, SMS পাঠানো, ফলো-আপ — সব অটোমেটেড।" },
      { title: "ফ্রড থেকে সুরক্ষা", detail: "রিটার্ন-হিস্ট্রি ও কাস্টমার রিস্ক প্রোফাইল দিয়ে টাকা ও সময় বাঁচান।" },
      { title: "মোবাইল-ফার্স্ট, ২৪/৭", detail: "অফিসে বসে থাকা লাগবে না — ফোন থেকেই পুরো ব্যবসা চালান।" },
      { title: "টিমের জন্য তৈরি", detail: "স্টাফ যোগ করুন, প্রতিটা মডিউলে আলাদা করে অ্যাক্সেস নিয়ন্ত্রণ করুন।" },
      { title: "বাড়ার সাথে বাড়ে", detail: "ছোট শপ থেকে মাল্টি-স্টাফ অপারেশন — প্যাকেজ বদলে স্কেল করুন।" },
    ],

    howTitle: "মাত্র ৩ ধাপে শুরু করুন",
    howDescription: "কার্ড ছাড়া, কোনো টেকনিক্যাল সেটআপ ছাড়াই — কয়েক মিনিটেই বিক্রি শুরু করা যায়।",
    howSteps: [
      { title: "ফ্রি রেজিস্ট্রেশন করুন", detail: "নাম, ফোন, ইমেইল দিয়ে অ্যাকাউন্ট খুলুন — কোনো কার্ড বা পেমেন্ট লাগে না।" },
      { title: "কুরিয়ার ও পেমেন্ট কানেক্ট করুন", detail: "আপনার পছন্দের কুরিয়ার আর পেমেন্ট গেটওয়ে কয়েক ক্লিকে যুক্ত করুন।" },
      { title: "অর্ডার নিন, ট্র্যাক করুন, লাভ দেখুন", detail: "ড্যাশবোর্ড থেকেই অর্ডার প্রসেস, ডেলিভারি ট্র্যাক আর প্রফিট রিপোর্ট — সব এক জায়গায়।" },
    ],

    ctaBandTitle: "আজই আপনার ব্যবসা BSOL-এ নিয়ে আসুন",
    ctaBandSubtitle: "কয়েক মিনিটেই একাউন্ট তৈরি করে অর্ডার, কুরিয়ার এবং কাস্টমার ম্যানেজমেন্ট শুরু করুন।",
    ctaBandButton: "ফ্রি অ্যাকাউন্ট তৈরি করুন",
    footerTagline: "বাংলাদেশি F-commerce ব্যবসার জন্য অল-ইন-ওয়ান অপারেশন প্ল্যাটফর্ম।",
    footerProductTitle: "প্রোডাক্ট",
    footerLegalTitle: "লিগ্যাল",
    footerAccountTitle: "অ্যাকাউন্ট",
    copyright: (year: number) => `© ${year} Zyrotech BSOL. সর্বস্বত্ব সংরক্ষিত।`,
    languageLabel: "ভাষা",
    themeLabel: "থিম",
    auth: {
      loginTab: "লগইন",
      registerTab: "রেজিস্ট্রেশন",
      nameLabel: "পূর্ণ নাম",
      namePlaceholder: "আপনার পূর্ণ নাম লিখুন",
      mobileLabel: "মোবাইল নম্বর",
      mobilePlaceholder: "01XXXXXXXXX",
      emailLabel: "ইমেইল অ্যাড্রেস",
      emailPlaceholder: "example@email.com",
      passwordLabel: "পাসওয়ার্ড",
      passwordPlaceholder: "মিনিমাম ৮ অক্ষর",
      confirmPasswordLabel: "পাসওয়ার্ড নিশ্চিত করুন",
      confirmPasswordPlaceholder: "পাসওয়ার্ড আবার লিখুন",
      loginBtn: "লগইন করুন",
      registerBtn: "অ্যাকাউন্ট তৈরি করুন",
      loggingIn: "লগইন হচ্ছে...",
      registering: "রেজিস্ট্রেশন হচ্ছে...",
      logoutBtn: "লগআউট",
      dashboardBtn: "ড্যাশবোর্ডে যান",
      welcomeBack: "স্বাগতম",
      loggedInAs: "আপনি সফলভাবে লগইন করেছেন।",
      mobileDisplay: "মোবাইল",
      emailDisplay: "ইমেইল",
      passwordMismatch: "পাসওয়ার্ড দুটি মিলছে না।",
      passwordTooShort: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।",
      authSectionTitle: "শুরু করুন",
      authSectionSubtitle: "লগইন করুন অথবা নতুন অ্যাকাউন্ট তৈরি করুন — সম্পূর্ণ ফ্রি।",
      forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    },
  },
  en: {
    brandName: "Zyrotech BSOL",
    nav: { features: "Features", how: "How it works", payments: "Payments", login: "Login", signup: "Free account" },
    badge: "The all-in-one platform for Bangladesh F-commerce businesses",
    title: "From order to profit — your whole business in one dashboard",
    subtitle:
      "Orders, 5 couriers, fake-order protection, 7 payment gateways, Facebook/WhatsApp/SMS marketing, a full storefront, and real profit tracking — all together. Run your business without spreadsheets or juggling five different apps.",
    heroHighlights: [
      "No card required to get started",
      "Fully supported in Bangla and English",
      "Run your entire business from your phone",
    ],
    ctaPrimary: "Create free account",
    ctaSecondary: "See all features",
    statStrip: [
      { label: "Courier partners", value: "5+" },
      { label: "Payment gateways", value: "7+" },
      { label: "Core feature modules", value: "15+" },
      { label: "Dashboard access", value: "24/7" },
    ],

    problemsTitle: "The problems quietly costing you time and money",
    problemsDescription: "Sound familiar? BSOL has a direct answer for each one.",
    problems: [
      {
        problem: "Fake/prank orders waste courier fees and your time",
        solution: "Check return-history across 5 couriers at once and catch risky orders before you ship",
      },
      {
        problem: "Tracking orders across couriers and spreadsheets is a mess",
        solution: "Every order, every courier's status — booking, tracking, and waybills from one dashboard",
      },
      {
        problem: "You can't tell how much your ad spend is actually earning",
        solution: "See real net profit — ad spend, product cost, and delivery charge combined automatically",
      },
      {
        problem: "Missed Messenger/WhatsApp messages mean lost sales",
        solution: "A lead inbox plus WhatsApp/SMS automation means no follow-up ever slips through",
      },
    ],

    sectionTitle: "Everything your business needs — all in one place",
    sectionDescription: "Every module is built around real day-to-day operations, so running your business gets simpler, not more complex.",

    paymentsTitle: "Payment gateways we support",
    paymentsDescription: "Have a merchant account? Use an automated gateway. Don't? Accept send-and-verify on your personal number instead — both paths are open.",
    payments: ["SSLCommerz", "bKash", "Nagad", "AamarPay", "ZiniPay", "ShurjoPay", "EPS"],
    paymentsWalletNote: "No merchant account needed — customers can also pay via send-money to your personal bKash / Nagad / Rocket number",

    couriersTitle: "Courier partners",
    couriers: ["Pathao", "Steadfast", "RedX", "Carrybee", "Paperfly"],

    benefitsTitle: "Why sellers choose BSOL",
    benefitsDescription: "Built on a solid foundation — it brings transparency to your business, saves time every day, and helps you decide with real data.",
    readyItems: [
      { title: "Full business transparency", detail: "Real profit/loss per order and a clear audit trail of who changed what." },
      { title: "Saves time every day", detail: "Manual courier entry, SMS sending, follow-ups — all automated." },
      { title: "Protection from fraud", detail: "Return-history and customer risk profiles save you money and time." },
      { title: "Mobile-first, 24/7", detail: "No need to be at a desk — run the whole business from your phone." },
      { title: "Built for teams", detail: "Add staff and control access to every module individually." },
      { title: "Grows with you", detail: "From a small shop to a multi-staff operation — scale by changing plans." },
    ],

    howTitle: "Get started in just 3 steps",
    howDescription: "No card, no technical setup — you can be selling within minutes.",
    howSteps: [
      { title: "Register for free", detail: "Sign up with your name, phone, and email — no card or payment needed." },
      { title: "Connect courier & payment", detail: "Add your preferred courier and payment gateway in a few clicks." },
      { title: "Take orders, track, profit", detail: "Process orders, track deliveries, and see profit reports — all from one dashboard." },
    ],

    ctaBandTitle: "Bring your business to BSOL today",
    ctaBandSubtitle: "Create your account in minutes and start managing orders, couriers, and customers.",
    ctaBandButton: "Create free account",
    footerTagline: "The all-in-one operations platform for Bangladesh F-commerce businesses.",
    footerProductTitle: "Product",
    footerLegalTitle: "Legal",
    footerAccountTitle: "Account",
    copyright: (year: number) => `© ${year} Zyrotech BSOL. All rights reserved.`,
    languageLabel: "Language",
    themeLabel: "Theme",
    auth: {
      loginTab: "Login",
      registerTab: "Register",
      nameLabel: "Full Name",
      namePlaceholder: "Enter your full name",
      mobileLabel: "Mobile Number",
      mobilePlaceholder: "01XXXXXXXXX",
      emailLabel: "Email Address",
      emailPlaceholder: "example@email.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 8 characters",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Re-enter your password",
      loginBtn: "Login",
      registerBtn: "Create Account",
      loggingIn: "Logging in...",
      registering: "Creating account...",
      logoutBtn: "Logout",
      dashboardBtn: "Go to dashboard",
      welcomeBack: "Welcome",
      loggedInAs: "You have successfully logged in.",
      mobileDisplay: "Mobile",
      emailDisplay: "Email",
      passwordMismatch: "Passwords do not match.",
      passwordTooShort: "Password must be at least 8 characters.",
      authSectionTitle: "Get started",
      authSectionSubtitle: "Login to your account or create a new one — completely free.",
      forgotPassword: "Forgot password?",
    },
  },
};

// ---------------------------------------------------------------------------
// Feature categories (icons kept outside the localized text, matched by index)
// ---------------------------------------------------------------------------
const categoryIcons = [Truck, ShieldAlert, MessageCircle, Store, LineChart, Users, Boxes];

const featureCategories = {
  bn: [
    {
      title: "অর্ডার ও কুরিয়ার",
      items: [
        "ম্যানুয়াল, বাল্ক CSV ও WooCommerce থেকে অটো অর্ডার সিঙ্ক",
        "৫টি কুরিয়ার — এক ড্যাশবোর্ড থেকে বুকিং ও ট্র্যাকিং",
        "বাল্ক পার্সেল বুকিং ও ওয়েবিল/স্টিকার প্রিন্ট",
        "রিয়েল-টাইম ডেলিভারি স্ট্যাটাস আপডেট",
      ],
    },
    {
      title: "ফ্রড ও রিস্ক প্রোটেকশন",
      items: [
        "কুরিয়ার রিটার্ন-হিস্টোরি অ্যাগ্রিগেট করা ফেইক-অর্ডার স্কোর",
        "কাস্টমার ব্ল্যাকলিস্ট ও ফোন-নম্বর রিস্ক প্রোফাইল",
        "অর্ডার কনফার্মেশনে OTP ভেরিফিকেশন",
      ],
    },
    {
      title: "মার্কেটিং, CRM ও অটোমেশন",
      items: [
        "Facebook Pixel + Conversions API (সার্ভার-সাইড)",
        "Messenger লিড ইনবক্স + অটো-রিপ্লাই টেমপ্লেট",
        "WhatsApp Business — অর্ডার-স্ট্যাটাস অটোমেশন + ইনবক্স",
        "SMS অটোমেশন + অ্যাবানডন্ড চেকআউট রিকভারি",
      ],
    },
    {
      title: "স্টোরফ্রন্ট ও ল্যান্ডিং পেজ",
      items: [
        "প্রতি-প্রোডাক্ট হাই-কনভার্টিং ল্যান্ডিং পেজ বিল্ডার",
        "পূর্ণাঙ্গ ব্রাউজেবল স্টোরফ্রন্ট — ক্যাটাগরি, সার্চ, কার্ট, রিভিউ",
        "নিজস্ব ব্র্যান্ডেড সাবডোমেইন (yourshop.zyrotechbd.com)",
        "ডিজিটাল প্রোডাক্ট ডেলিভারি (e-book, কোর্স, সফটওয়্যার)",
      ],
    },
    {
      title: "অ্যাকাউন্টিং ও ইনসাইট",
      items: [
        "অ্যাড স্পেন্ড, COGS, ডেলিভারি চার্জ মিলিয়ে রিয়েল নেট প্রফিট",
        "সব সোর্সের পেমেন্ট কালেকশন হিস্ট্রি এক জায়গায়",
        "ইনভয়েস ও ওয়েবিল PDF",
      ],
    },
    {
      title: "টিম ও অ্যাক্সেস কন্ট্রোল",
      items: [
        "স্টাফ অ্যাকাউন্ট যোগ করুন, মডিউল-ভিত্তিক পারমিশন",
        "প্রতিটা অ্যাকশনের অডিট ট্রেইল",
        "WordPress/WooCommerce প্লাগইন কানেক্টর",
      ],
    },
    {
      title: "প্ল্যাটফর্ম",
      items: [
        "বাংলা ও ইংরেজি — সম্পূর্ণ দ্বিভাষিক UI",
        "ডার্ক / লাইট থিম, মোবাইল-ফার্স্ট ডিজাইন",
        "প্যাকেজ অনুযায়ী স্কেল করার সুবিধা",
      ],
    },
  ],
  en: [
    {
      title: "Orders & Courier",
      items: [
        "Manual entry, bulk CSV import, and WooCommerce auto-sync",
        "5 couriers — booking and tracking from one dashboard",
        "Bulk parcel booking and waybill/sticker printing",
        "Real-time delivery status updates",
      ],
    },
    {
      title: "Fraud & Risk Protection",
      items: [
        "Fake-order score aggregated from courier return history",
        "Customer blacklist and phone-number risk profiles",
        "OTP verification at order confirmation",
      ],
    },
    {
      title: "Marketing, CRM & Automation",
      items: [
        "Facebook Pixel + Conversions API (server-side)",
        "Messenger lead inbox + auto-reply templates",
        "WhatsApp Business — order-status automation + inbox",
        "SMS automation + abandoned checkout recovery",
      ],
    },
    {
      title: "Storefront & Landing Pages",
      items: [
        "Per-product, high-converting landing page builder",
        "A full browsable storefront — categories, search, cart, reviews",
        "Your own branded subdomain (yourshop.zyrotechbd.com)",
        "Digital product delivery (e-books, courses, software)",
      ],
    },
    {
      title: "Accounting & Insights",
      items: [
        "Real net profit — ad spend, COGS, and delivery charge combined",
        "Payment collection history from every source in one place",
        "Invoice and waybill PDFs",
      ],
    },
    {
      title: "Team & Access Control",
      items: [
        "Add staff accounts with module-based permissions",
        "A full audit trail for every action",
        "WordPress/WooCommerce plugin connector",
      ],
    },
    {
      title: "Platform",
      items: [
        "Bangla and English — fully bilingual UI",
        "Dark / light theme, mobile-first design",
        "Scales with you as you upgrade plans",
      ],
    },
  ],
};

const benefitIcons = [BadgeCheck, Clock3, ShieldAlert, ShoppingBag, Users, TrendingUp];
const paymentIcons = [CreditCard, Wallet, Wallet, CreditCard, CreditCard, CreditCard, CreditCard];

// ---------------------------------------------------------------------------
// Scroll-reveal wrapper (IntersectionObserver, CSS-driven — see globals.css)
// ---------------------------------------------------------------------------
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`home-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------
function FormInput({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[var(--muted)] sm:text-sm">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth Section (tab is controlled from the page so header CTAs can preset it)
// ---------------------------------------------------------------------------
function AuthSection({
  locale,
  t,
  tab,
  onTabChange,
}: {
  locale: Locale;
  t: (typeof content)["bn"]["auth"];
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
    }
    captureAttribution();
  }, []);

  function clearErrors() {
    setError(null);
  }

  function persistAuth(token: string, loginResponse: Record<string, unknown>) {
    const merged = mergeAuthPayload(loginResponse as Parameters<typeof mergeAuthPayload>[0]);
    const normalizedUser: AuthUser = {
      ...merged,
      role: merged.role === "admin" ? "admin" : "user",
    };
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);

    const destination = normalizedUser.role === "admin" ? "/admin" : "/dashboard";
    window.location.href = destination;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstError = data?.errors
          ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
          : data?.message;
        setError(firstError ?? "Login failed.");
      } else if (data?.redirect_to) {
        // Seller owns a branded subdomain: no token was issued here, only a
        // single-use handoff code in this URL. The destination origin mints
        // its own token (custom_domain_context.md §6).
        window.location.href = data.redirect_to;
      } else {
        persistAuth(data.token, data);
        setLoginEmail("");
        setLoginPassword("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (regPassword.length < 8) {
      setError(t.passwordTooShort);
      return;
    }
    if (regPassword !== regConfirm) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/otp/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: regName,
          mobile: regMobile,
          email: regEmail,
          password: regPassword,
          password_confirmation: regConfirm,
          ...readAttributionForRegister(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const firstError = data?.errors
          ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
          : data?.message;
        setError(firstError ?? "Registration failed.");
      } else {
        sessionStorage.setItem("otp_token", data.token as string);
        sessionStorage.setItem("otp_mobile", data.mobile as string);
        if (data?.next_resend_after_seconds !== undefined) {
          sessionStorage.setItem("otp_resend_cooldown", String(data.next_resend_after_seconds));
        }
        window.location.href = "/verify-phone";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    clearErrors();
  }

  if (user) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
            {t.welcomeBack}, {user.name}!
          </h2>
          <div className="flex items-center gap-2">
            <a
              href={user.role === "admin" ? "/admin" : "/dashboard"}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t.dashboardBtn}
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-400"
            >
              {t.logoutBtn}
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">{t.loggedInAs}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {user.mobile && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {t.mobileDisplay}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.mobile}</p>
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.emailDisplay}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.email}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
        {(["login", "register"] as AuthTab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => {
              onTabChange(tabKey);
              clearErrors();
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              tab === tabKey
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--surface)]"
            }`}
          >
            {tabKey === "login" ? t.loginTab : t.registerTab}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          <FormInput
            id="login_email"
            label={t.emailLabel}
            type="email"
            placeholder={t.emailPlaceholder}
            value={loginEmail}
            onChange={setLoginEmail}
            required
            autoComplete="email"
          />
          <FormInput
            id="login_password"
            label={t.passwordLabel}
            type="password"
            placeholder={t.passwordPlaceholder}
            value={loginPassword}
            onChange={setLoginPassword}
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.loggingIn : t.loginBtn}
          </button>
          <div className="text-center">
            <a href={`/forgot-password?lang=${locale}`} className="text-sm text-[var(--accent)] hover:underline">
              {t.forgotPassword}
            </a>
          </div>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
          <FormInput
            id="reg_name"
            label={t.nameLabel}
            type="text"
            placeholder={t.namePlaceholder}
            value={regName}
            onChange={setRegName}
            required
            autoComplete="name"
          />
          <FormInput
            id="reg_mobile"
            label={t.mobileLabel}
            type="tel"
            placeholder={t.mobilePlaceholder}
            value={regMobile}
            onChange={setRegMobile}
            required
            autoComplete="tel"
          />
          <FormInput
            id="reg_email"
            label={t.emailLabel}
            type="email"
            placeholder={t.emailPlaceholder}
            value={regEmail}
            onChange={setRegEmail}
            required
            autoComplete="email"
          />
          <FormInput
            id="reg_password"
            label={t.passwordLabel}
            type="password"
            placeholder={t.passwordPlaceholder}
            value={regPassword}
            onChange={setRegPassword}
            required
            autoComplete="new-password"
          />
          <FormInput
            id="reg_confirm"
            label={t.confirmPasswordLabel}
            type="password"
            placeholder={t.confirmPasswordPlaceholder}
            value={regConfirm}
            onChange={setRegConfirm}
            required
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.registering : t.registerBtn}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [heroReady, setHeroReady] = useState(false);
  const [legalLinks, setLegalLinks] = useState<{
    terms_link_label_bn?: string | null;
    terms_link_label_en?: string | null;
    privacy_link_label_bn?: string | null;
    privacy_link_label_en?: string | null;
  } | null>(null);

  const authRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
    setTheme(getStoredTheme());
    // Hero entrance animation fires once on first paint (not gated behind
    // IntersectionObserver like the rest of the page — it's always in view).
    setHeroReady(true);
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
    fetch(`${API_BASE_URL}/public/platform-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) setLegalLinks(json.data);
      })
      .catch(() => {
        // footer legal labels fall back to defaults below
      });
  }, []);

  const text = useMemo(() => content[locale], [locale]);
  const categories = useMemo(() => featureCategories[locale], [locale]);
  const year = new Date().getFullYear();

  function goToAuth(tab: AuthTab) {
    setAuthTab(tab);
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const termsLabel =
    (locale === "bn" ? legalLinks?.terms_link_label_bn : legalLinks?.terms_link_label_en) ||
    (locale === "bn" ? "ব্যবহারের শর্তাবলি" : "Terms of Use");
  const privacyLabel =
    (locale === "bn" ? legalLinks?.privacy_link_label_bn : legalLinks?.privacy_link_label_en) ||
    (locale === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy");

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <MetaPixelScript />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/app-icon-1024.png"
              alt={text.brandName}
              width={38}
              height={38}
              className="rounded-xl border border-[var(--border)]"
              priority
            />
            <span className="text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
              {text.brandName}
            </span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => scrollTo(featuresRef)}
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {text.nav.features}
            </button>
            <button
              type="button"
              onClick={() => scrollTo(paymentsRef)}
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {text.nav.payments}
            </button>
            <button
              type="button"
              onClick={() => scrollTo(howRef)}
              className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {text.nav.how}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              title={text.languageLabel}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:text-sm"
            >
              <Languages size={16} />
              <span className="hidden sm:inline">{locale === "bn" ? "বাংলা" : "English"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={text.themeLabel}
              className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 text-[var(--foreground)] transition hover:bg-[var(--surface)]"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => goToAuth("login")}
              className="hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:inline-flex"
            >
              {text.nav.login}
            </button>
            <button
              type="button"
              onClick={() => goToAuth("register")}
              className="rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {text.nav.signup}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Hero */}
        <section className="relative grid gap-8 overflow-hidden lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10">
          {/* Decorative floating gradient blobs — purely visual, kept subtle
              (low opacity) and off to the sides so they never reduce
              contrast under the heading/subtitle text sitting on top. */}
          <div
            aria-hidden
            className="home-float pointer-events-none absolute -left-32 -top-32 -z-10 h-72 w-72 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          />
          <div
            aria-hidden
            className="home-float pointer-events-none absolute -right-20 top-20 -z-10 h-64 w-64 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", animationDelay: "2s" }}
          />

          <div className={`relative space-y-5 ${heroReady ? "home-hero-in" : "opacity-0"}`}>
            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--muted)] sm:text-sm">
              {text.badge}
            </span>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl lg:text-5xl">
              {text.title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
              {text.subtitle}
            </p>

            <ul className="flex flex-col gap-2.5 pt-1 sm:gap-3">
              {text.heroHighlights.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--foreground)] sm:text-base">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    <BadgeCheck size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => goToAuth("register")}
                className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base"
              >
                {text.ctaPrimary}
              </button>
              <button
                type="button"
                onClick={() => scrollTo(featuresRef)}
                className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] sm:text-base"
              >
                {text.ctaSecondary}
              </button>
            </div>
          </div>

          {/* Auth card */}
          <div
            ref={authRef}
            className={`relative scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg shadow-black/5 sm:p-6 ${heroReady ? "home-hero-in" : "opacity-0"}`}
            style={{ animationDelay: "150ms" }}
          >
            <h2 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">
              {text.auth.authSectionTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{text.auth.authSectionSubtitle}</p>
            <div className="mt-5">
              <AuthSection locale={locale} t={text.auth} tab={authTab} onTabChange={setAuthTab} />
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <Reveal className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-5 sm:grid-cols-4 sm:p-6">
          {text.statStrip.map((stat, idx) => (
            <div key={stat.label} className="home-stat-in text-center sm:text-left" style={{ animationDelay: `${idx * 90}ms` }}>
              <p className="text-lg font-bold text-[var(--foreground)] sm:text-2xl">{stat.value}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </Reveal>

        {/* Problems -> Solutions */}
        <section className="mt-16">
          <Reveal className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {text.problemsTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.problemsDescription}</p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {text.problems.map((item, idx) => (
              <Reveal key={item.problem} delay={idx * 80}>
                <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                      <XCircle size={14} />
                    </span>
                    <p className="text-sm leading-6 text-[var(--muted)]">{item.problem}</p>
                  </div>
                  <div className="mt-3 flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 size={14} />
                    </span>
                    <p className="text-sm font-medium leading-6 text-[var(--foreground)]">{item.solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section ref={featuresRef} id="features" className="mt-16 scroll-mt-20">
          <Reveal className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {text.sectionTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.sectionDescription}</p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((cat, idx) => {
              const Icon = categoryIcons[idx % categoryIcons.length];
              return (
                <Reveal key={cat.title} delay={(idx % 3) * 80}>
                  <article className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/40 hover:shadow-md">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                      <Icon size={20} />
                    </span>
                    <h4 className="mt-3.5 text-base font-semibold text-[var(--foreground)]">{cat.title}</h4>
                    <ul className="mt-2.5 space-y-1.5">
                      {cat.items.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-sm leading-6 text-[var(--muted)]">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Payments + Couriers */}
        <section ref={paymentsRef} id="payments" className="mt-16 scroll-mt-20">
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                <Wallet size={20} />
              </span>
              <h3 className="mt-3.5 text-xl font-bold tracking-tight text-[var(--foreground)]">{text.paymentsTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text.paymentsDescription}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {text.payments.map((name, idx) => {
                  const Icon = paymentIcons[idx % paymentIcons.length];
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                    >
                      <Icon size={14} className="text-[var(--accent)]" />
                      {name}
                    </span>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{text.paymentsWalletNote}</p>
            </Reveal>

            <Reveal delay={100} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                <Truck size={20} />
              </span>
              <h3 className="mt-3.5 text-xl font-bold tracking-tight text-[var(--foreground)]">{text.couriersTitle}</h3>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {text.couriers.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    <Truck size={14} className="text-[var(--accent)]" />
                    {name}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                  <FileText size={16} />
                </span>
                <p className="text-xs leading-5 text-[var(--muted)] sm:text-sm">
                  {locale === "bn"
                    ? "ওয়েবিল, স্টিকার ও ইনভয়েস — সব PDF-এ প্রিন্ট-রেডি"
                    : "Waybills, stickers, and invoices — all print-ready as PDF"}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Benefits */}
        <section className="mt-16 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
            <Reveal>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {text.benefitsTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.benefitsDescription}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {text.readyItems.map((item, idx) => {
                  const Icon = benefitIcons[idx % benefitIcons.length];
                  return (
                    <li
                      key={item.title}
                      className="flex items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                        <Icon size={16} />
                      </span>
                      <span className="text-sm leading-6 text-[var(--foreground)]">
                        <span className="font-semibold">{item.title}</span>
                        <span className="block text-[var(--muted)]">{item.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            {/* Decorative abstract dashboard illustration */}
            <Reveal delay={120} className="relative hidden aspect-[4/3] w-full overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/15 via-transparent to-[var(--accent)]/5" />
              <div className="absolute left-6 right-6 top-6 h-8 rounded-lg bg-[var(--surface)] shadow-sm" />
              <div className="absolute left-6 top-20 h-24 w-[46%] rounded-2xl bg-[var(--surface)] shadow-sm" />
              <div className="absolute right-6 top-20 h-24 w-[46%] rounded-2xl bg-[var(--accent)]/20" />
              <div className="absolute bottom-6 left-6 right-6 h-28 rounded-2xl bg-[var(--surface)] shadow-sm">
                <div className="flex h-full items-end gap-2 px-4 pb-4">
                  {[40, 65, 50, 80, 60, 90, 45].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="w-full rounded-md bg-[var(--accent)]"
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section ref={howRef} id="how" className="mt-16 scroll-mt-20">
          <Reveal className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {text.howTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">{text.howDescription}</p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {text.howSteps.map((item, idx) => (
              <Reveal key={item.title} delay={idx * 100}>
                <div className="relative h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                    {idx + 1}
                  </span>
                  <h4 className="mt-3 text-base font-semibold text-[var(--foreground)]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <Reveal className="mt-16 overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/80 p-6 text-center sm:p-10">
          <h3 className="text-xl font-bold text-white sm:text-2xl">{text.ctaBandTitle}</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/85 sm:text-base">{text.ctaBandSubtitle}</p>
          <button
            type="button"
            onClick={() => goToAuth("register")}
            className="mt-5 inline-flex items-center rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-[var(--accent)] shadow-sm transition hover:opacity-90 sm:text-base"
          >
            {text.ctaBandButton}
          </button>
        </Reveal>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-[var(--border)]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Image
                src="/app-icon-1024.png"
                alt={text.brandName}
                width={32}
                height={32}
                className="rounded-lg border border-[var(--border)]"
              />
              <span className="text-base font-bold text-[var(--foreground)]">{text.brandName}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">{text.footerTagline}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerProductTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <button type="button" onClick={() => scrollTo(featuresRef)} className="hover:text-[var(--foreground)]">
                  {text.nav.features}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(paymentsRef)} className="hover:text-[var(--foreground)]">
                  {text.nav.payments}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo(howRef)} className="hover:text-[var(--foreground)]">
                  {text.nav.how}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerAccountTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <button type="button" onClick={() => goToAuth("login")} className="hover:text-[var(--foreground)]">
                  {text.nav.login}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => goToAuth("register")} className="hover:text-[var(--foreground)]">
                  {text.nav.signup}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{text.footerLegalTitle}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>
                <a href={`/terms?lang=${locale}`} className="hover:text-[var(--foreground)]">
                  {termsLabel}
                </a>
              </li>
              <li>
                <a href={`/privacy?lang=${locale}`} className="hover:text-[var(--foreground)]">
                  {privacyLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-5 text-center text-xs text-[var(--muted)] sm:px-6 lg:px-8">
          {text.copyright(year)}
        </div>
      </footer>
    </div>
  );
}
