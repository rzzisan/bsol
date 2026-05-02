"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="customer-list"
      defaultExpandedKey="customers"
      pageTitle={{ bn: "কাস্টমার তালিকা", en: "Customer List" }}
    >
      <ModulePlaceholder
        icon="👥"
        titleBn="কাস্টমার তালিকা"
        titleEn="Customer List"
        descBn="সকল কাস্টমারের প্রোফাইল, অর্ডার হিস্টোরি এবং ফ্রড স্কোর দেখুন।"
        descEn="View all customer profiles, order history and fraud scores."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
