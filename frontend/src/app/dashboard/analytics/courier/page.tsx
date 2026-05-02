"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="courier-report"
      defaultExpandedKey="analytics"
      pageTitle={{ bn: "কুরিয়ার বিশ্লেষণ", en: "Courier Analytics" }}
    >
      <ModulePlaceholder
        icon="🚛"
        titleBn="কুরিয়ার বিশ্লেষণ"
        titleEn="Courier Analytics"
        descBn="কুরিয়ার-ভিত্তিক ডেলিভারি সাফল্য, রিটার্ন রেট এবং খরচ বিশ্লেষণ।"
        descEn="Courier-wise delivery success, return rate and cost analysis."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
