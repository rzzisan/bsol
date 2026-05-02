"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="vip-customers"
      defaultExpandedKey="customers"
      pageTitle={{ bn: "VIP কাস্টমার", en: "VIP Customers" }}
    >
      <ModulePlaceholder
        icon="⭐"
        titleBn="VIP কাস্টমার"
        titleEn="VIP Customers"
        descBn="বারবার অর্ডার করা মূল্যবান কাস্টমারদের তালিকা।"
        descEn="List of high-value customers with repeat orders."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
