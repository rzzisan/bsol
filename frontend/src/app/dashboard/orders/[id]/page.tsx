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
      pageTitle={{ bn: "অর্ডার বিস্তারিত", en: "Order Detail" }}
    >
      <ModulePlaceholder
        icon="📋"
        titleBn="অর্ডার বিস্তারিত"
        titleEn="Order Detail"
        descBn="অর্ডারের সম্পূর্ণ তথ্য, স্ট্যাটাস টাইমলাইন, ফ্রড স্কোর এবং কুরিয়ার ট্র্যাকিং।"
        descEn="Complete order information, status timeline, fraud score and courier tracking."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
