"use client";

import { use } from "react";
import LandingPageEditor from "@/components/landing-page-editor";
import UserShell from "@/components/user-shell";

export default function EditLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <UserShell
      activeKey="landing-pages"
      defaultExpandedKey="landing"
      pageTitle={{ bn: "ল্যান্ডিং পেইজ এডিট", en: "Edit Landing Page" }}
      pageSubtitle={{ bn: "কনটেন্ট, প্রডাক্ট ও policy links আপডেট করুন", en: "Update content, products, and policy links" }}
    >
      <LandingPageEditor pageId={Number(id)} />
    </UserShell>
  );
}
