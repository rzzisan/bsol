"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="fraud-check"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "ফ্রড চেক", en: "Fraud Check" }}
    >
      <ModulePlaceholder
        icon="🔍"
        titleBn="ফ্রড চেক"
        titleEn="Fraud Check"
        descBn="ফোন নম্বর দিয়ে কাস্টমারের ফ্রড স্কোর, রিটার্ন হিস্টোরি এবং ঝুঁকির মাত্রা যাচাই করুন।"
        descEn="Verify customer fraud score, return history and risk level using phone number."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
