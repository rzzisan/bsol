"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="daily-report"
      defaultExpandedKey="accounting"
      pageTitle={{ bn: "দৈনিক রিপোর্ট", en: "Daily Report" }}
    >
      <ModulePlaceholder
        icon="🧾"
        titleBn="দৈনিক রিপোর্ট"
        titleEn="Daily Report"
        descBn="আজকের আয়, ব্যয়, এবং মুনাফার সারসংক্ষেপ।"
        descEn="Today's income, expense and profit summary."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
