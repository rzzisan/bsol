"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import LandingPageStudio from "@/components/landing-page-studio";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

const text: Record<string, Record<string, string>> = {
  bn: {
    title: "নতুন ল্যান্ডিং পেজ তৈরি করুন",
    name: "পেজের নাম",
    submit: "তৈরি করুন",
    success: "ল্যান্ডিং পেজ সফলভাবে তৈরি হয়েছে!",
    error: "ত্রুটি হয়েছে, আবার চেষ্টা করুন।",
  },
  en: {
    title: "Create New Landing Page",
    name: "Page Name",
    submit: "Create",
    success: "Landing page created successfully!",
    error: "Something went wrong, please try again.",
  },
};

export default function CreateLandingPage() {
  const [locale, setLocale] = useState<Locale>("bn");

  useEffect(() => {
    setLocale(getStoredLocale());

    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{
        bn: "একটি নতুন landing page draft তৈরি করুন।",
        en: "Create a new draft landing page.",
      }}
    >
      <LandingPageStudio locale={locale} mode="create" />
    </UserShell>
  );
}
