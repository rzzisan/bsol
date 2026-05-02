"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="expenses"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: "খরচ ট্র্যাকার", en: "Expense Tracker" }}
    >
      <ModulePlaceholder
        icon="💸"
        titleBn="খরচ ট্র্যাকার"
        titleEn="Expense Tracker"
        descBn="বিজ্ঞাপন খরচ, কুরিয়ার চার্জ এবং অন্যান্য ব্যয় ট্র্যাক করুন।"
        descEn="Track ad spend, courier charges and other business expenses."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
