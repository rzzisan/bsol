"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="sales-report"
      defaultExpandedKey="analytics"
      pageTitle={{ bn: "সেলস রিপোর্ট", en: "Sales Report" }}
    >
      <ModulePlaceholder
        icon="📊"
        titleBn="সেলস রিপোর্ট"
        titleEn="Sales Report"
        descBn="দৈনিক, সাপ্তাহিক ও মাসিক বিক্রয় রিপোর্ট, অর্ডার ট্রেন্ড এবং টপ পণ্য।"
        descEn="Daily, weekly and monthly sales reports, order trends and top products."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
