"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="product-list"
      defaultExpandedKey="products"
      pageTitle={{ bn: "পণ্য তালিকা", en: "Product List" }}
    >
      <ModulePlaceholder
        icon="🛍️"
        titleBn="পণ্য তালিকা"
        titleEn="Product List"
        descBn="আপনার সকল পণ্য দেখুন, যোগ করুন এবং সম্পাদনা করুন।"
        descEn="View, add and edit all your products."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
