"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="intelligence"
      defaultExpandedKey="analytics"
      pageTitle={{ bn: "কাস্টমার ইন্টেলিজেন্স", en: "Customer Intelligence" }}
    >
      <ModulePlaceholder
        icon="🧠"
        titleBn="কাস্টমার ইন্টেলিজেন্স"
        titleEn="Customer Intelligence"
        descBn="কাস্টমার স্কোরিং, রিপিট বায়ার ডিটেকশন, জেলাভিত্তিক অর্ডার হিটম্যাপ।"
        descEn="Customer scoring, repeat buyer detection, district-wise order heatmap."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
