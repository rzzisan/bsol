"use client";

import { useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import ModulePlaceholder from "@/components/module-placeholder";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function Page() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="shop-profile"
      defaultExpandedKey="settings"
      pageTitle={{ bn: "শপ প্রোফাইল", en: "Shop Profile" }}
    >
      <ModulePlaceholder
        icon="🏪"
        titleBn="শপ প্রোফাইল"
        titleEn="Shop Profile"
        descBn="আপনার শপের নাম, লোগো, ঠিকানা এবং যোগাযোগের তথ্য সেট করুন।"
        descEn="Set your shop name, logo, address and contact information."
        phase="Phase 1"
        locale={locale}
      />
    </UserShell>
  );
}
