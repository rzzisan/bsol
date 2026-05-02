"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="track-orders"
      defaultExpandedKey="courier"
      pageTitle={{ bn: "অর্ডার ট্র্যাক করুন", en: "Track Orders" }}
    >
      <ModulePlaceholder
        icon="📍"
        titleBn="অর্ডার ট্র্যাক করুন"
        titleEn="Track Orders"
        descBn="ট্র্যাকিং নম্বর দিয়ে কুরিয়ার স্ট্যাটাস রিয়েলটাইম দেখুন।"
        descEn="View real-time courier status with tracking number."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
