"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="ads-roi"
      defaultExpandedKey="analytics"
      pageTitle={{ bn: "Ads ROI ট্র্যাকার", en: "Ads ROI Tracker" }}
    >
      <ModulePlaceholder
        icon="🎯"
        titleBn="Ads ROI ট্র্যাকার"
        titleEn="Ads ROI Tracker"
        descBn="কোন ফেসবুক বিজ্ঞাপন থেকে কত অর্ডার এসেছে, ROAS এবং ফেক অর্ডার রেশিও।"
        descEn="Track which Facebook ads generated orders, ROAS and fake order ratio."
        phase="Phase 3"
        locale={locale}
      />
    </UserShell>
  );
}
