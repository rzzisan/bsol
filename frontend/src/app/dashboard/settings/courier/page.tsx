"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="courier-accounts"
      defaultExpandedKey="settings"
      pageTitle={{ bn: "কুরিয়ার একাউন্ট", en: "Courier Accounts" }}
    >
      <ModulePlaceholder
        icon="🔗"
        titleBn="কুরিয়ার একাউন্ট"
        titleEn="Courier Accounts"
        descBn="Pathao, Steadfast, RedX API কী সংযুক্ত করুন এবং পরিচালনা করুন।"
        descEn="Connect and manage Pathao, Steadfast, RedX API keys."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
