"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="risky-customers"
      defaultExpandedKey="customers"
      pageTitle={{ bn: "ঝুঁকিপূর্ণ কাস্টমার", en: "Risky Customers" }}
    >
      <ModulePlaceholder
        icon="⚠️"
        titleBn="ঝুঁকিপূর্ণ কাস্টমার"
        titleEn="Risky Customers"
        descBn="উচ্চ ফ্রড স্কোর বা বেশি রিটার্ন রেটের কাস্টমারদের তালিকা।"
        descEn="List of customers with high fraud score or excessive return rates."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
