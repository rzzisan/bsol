"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="profit"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: "মুনাফা ড্যাশবোর্ড", en: "Profit Dashboard" }}
    >
      <ModulePlaceholder
        icon="💰"
        titleBn="মুনাফা ড্যাশবোর্ড"
        titleEn="Profit Dashboard"
        descBn="আয় − পণ্য খরচ − কুরিয়ার − বিজ্ঞাপন = নিট মুনাফা বিশ্লেষণ।"
        descEn="Revenue minus COGS, courier, ad spend = net profit analysis."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
