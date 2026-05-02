"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="subscription"
      defaultExpandedKey="settings"
      pageTitle={{ bn: "সাবস্ক্রিপশন", en: "Subscription" }}
    >
      <ModulePlaceholder
        icon="💳"
        titleBn="সাবস্ক্রিপশন"
        titleEn="Subscription"
        descBn="আপনার বর্তমান প্ল্যান দেখুন এবং আপগ্রেড করুন।"
        descEn="View your current subscription plan and upgrade."
        phase="Phase 3"
        locale={locale}
      />
    </UserShell>
  );
}
