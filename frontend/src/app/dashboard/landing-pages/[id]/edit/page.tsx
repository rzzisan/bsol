"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import UserShell from "@/components/user-shell";
import LandingPageStudio from "@/components/landing-page-studio";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

const text: Record<string, Record<string, string>> = {
  bn: {
    title: "ল্যান্ডিং পেজ এডিট করুন",
    name: "পেজের নাম",
    save: "সংরক্ষণ করুন",
    success: "আপডেট সফল!",
    error: "ত্রুটি হয়েছে, আবার চেষ্টা করুন।",
    loading: "লোড হচ্ছে...",
  },
  en: {
    title: "Edit Landing Page",
    name: "Page Name",
    save: "Save",
    success: "Update successful!",
    error: "Something went wrong, please try again.",
    loading: "Loading...",
  },
};

export default function EditLandingPage() {
  const [locale, setLocale] = useState<Locale>("bn");
  const params = useParams<{ id: string }>();
  const pageId = Array.isArray(params?.id) ? params.id[0] : params?.id;

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
        bn: "Landing page এর নাম ও তথ্য আপডেট করুন।",
        en: "Update the landing page name and details.",
      }}
    >
      <LandingPageStudio locale={locale} mode="edit" pageId={pageId} />
    </UserShell>
  );
}
