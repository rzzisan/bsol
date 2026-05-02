"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="courier-perf"
      defaultExpandedKey="courier"
      pageTitle={{ bn: "কুরিয়ার পারফরমেন্স", en: "Courier Performance" }}
    >
      <ModulePlaceholder
        icon="📈"
        titleBn="কুরিয়ার পারফরমেন্স"
        titleEn="Courier Performance"
        descBn="এলাকাভিত্তিক ডেলিভারি সাফল্যের হার, রিটার্ন রেট এবং সেরা কুরিয়ার সাজেশন।"
        descEn="Area-wise delivery success rate, return rate and best courier suggestions."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
