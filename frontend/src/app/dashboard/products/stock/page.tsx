"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="stock"
      defaultExpandedKey="products"
      pageTitle={{ bn: "স্টক ম্যানেজমেন্ট", en: "Stock Management" }}
    >
      <ModulePlaceholder
        icon="📊"
        titleBn="স্টক ম্যানেজমেন্ট"
        titleEn="Stock Management"
        descBn="পণ্যের স্টক লেভেল ট্র্যাক করুন, লো-স্টক অ্যালার্ট পান।"
        descEn="Track product stock levels and receive low-stock alerts."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
