"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="book-parcel"
      defaultExpandedKey="courier"
      pageTitle={{ bn: "পার্সেল বুক করুন", en: "Book Parcel" }}
    >
      <ModulePlaceholder
        icon="🚚"
        titleBn="পার্সেল বুক করুন"
        titleEn="Book Parcel"
        descBn="Pathao, Steadfast, RedX সহ বিভিন্ন কুরিয়ারে পার্সেল বুক করুন।"
        descEn="Book parcels with Pathao, Steadfast, RedX and other couriers."
        phase="Phase 2"
        locale={locale}
      />
    </UserShell>
  );
}
