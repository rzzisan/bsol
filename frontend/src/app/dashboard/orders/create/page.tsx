"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="create-order"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "নতুন অর্ডার তৈরি", en: "Create New Order" }}
    >
      <ModulePlaceholder
        icon="➕"
        titleBn="নতুন অর্ডার তৈরি"
        titleEn="Create New Order"
        descBn="নতুন অর্ডার তৈরি করুন — কাস্টমার তথ্য, পণ্য, ডেলিভারি ঠিকানা সহ।"
        descEn="Create a new order with customer info, products, and delivery address."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
