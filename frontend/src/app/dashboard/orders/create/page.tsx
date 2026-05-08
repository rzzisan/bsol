"use client";

import { useState } from "react";
import UserShell from "@/components/user-shell";
import OrderIntakeForm from "@/components/orders/order-intake-form";
import { getStoredLocale, type Locale } from "@/lib/dashboard-client";

export default function CreateOrderPage() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="create-order"
      defaultExpandedKey="orders"
      pageTitle={{ bn: "নতুন অর্ডার", en: "New Order" }}
      pageSubtitle={{
        bn: "এক পেজেই দ্রুত গ্রাহক, পণ্য, পেমেন্টসহ অর্ডার নিন",
        en: "Take complete orders from one page with customer, items and payment",
      }}
    >
      <OrderIntakeForm key={locale} />
    </UserShell>
  );
}
