"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="categories"
      defaultExpandedKey="products"
      pageTitle={{ bn: "ক্যাটাগরি ম্যানেজমেন্ট", en: "Category Management" }}
    >
      <ModulePlaceholder
        icon="🗂️"
        titleBn="ক্যাটাগরি ম্যানেজমেন্ট"
        titleEn="Category Management"
        descBn="পণ্যের ক্যাটাগরি তৈরি এবং পরিচালনা করুন।"
        descEn="Create and manage product categories."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
