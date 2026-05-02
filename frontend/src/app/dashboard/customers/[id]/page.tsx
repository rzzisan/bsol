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
      pageTitle={{ bn: "কাস্টমার প্রোফাইল", en: "Customer Profile" }}
    >
      <ModulePlaceholder
        icon="👤"
        titleBn="কাস্টমার প্রোফাইল"
        titleEn="Customer Profile"
        descBn="কাস্টমারের বিস্তারিত প্রোফাইল, SMS লগ, অর্ডার হিস্টোরি এবং কনটাক্ট নোট।"
        descEn="Detailed customer profile, SMS log, order history and contact notes."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
