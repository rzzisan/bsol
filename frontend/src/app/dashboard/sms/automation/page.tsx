"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="sms-automation"
      defaultExpandedKey="sms"
      pageTitle={{ bn: "SMS অটোমেশন", en: "SMS Automation" }}
    >
      <ModulePlaceholder
        icon="🤖"
        titleBn="SMS অটোমেশন"
        titleEn="SMS Automation"
        descBn="অর্ডার কনফার্ম, শিপমেন্ট, ডেলিভারি — প্রতিটি ঘটনায় স্বয়ংক্রিয় SMS পাঠান।"
        descEn="Send automated SMS for order confirmation, shipping, delivery and more."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
