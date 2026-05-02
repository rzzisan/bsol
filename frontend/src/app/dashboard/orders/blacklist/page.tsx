"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="blacklist"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "ব্লকলিস্ট", en: "Blacklist" }}
    >
      <ModulePlaceholder
        icon="🚫"
        titleBn="ব্লকলিস্ট"
        titleEn="Blacklist"
        descBn="ব্লক করা কাস্টমারদের তালিকা দেখুন এবং পরিচালনা করুন।"
        descEn="View and manage your list of blocked customers."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
