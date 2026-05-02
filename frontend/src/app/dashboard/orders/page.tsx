"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="all-orders"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "সকল অর্ডার", en: "All Orders" }}
    >
      <ModulePlaceholder
        icon="📦"
        titleBn="সকল অর্ডার"
        titleEn="All Orders"
        descBn="আপনার সকল অর্ডার এক জায়গায় দেখুন, ফিল্টার করুন এবং পরিচালনা করুন।"
        descEn="View, filter and manage all your orders in one place."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
