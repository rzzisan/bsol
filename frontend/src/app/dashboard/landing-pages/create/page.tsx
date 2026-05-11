"use client";

import LandingPageEditor from "@/components/landing-page-editor";
import UserShell from "@/components/user-shell";

export default function CreateLandingPage() {
  return (
    <UserShell
      activeKey="landing-create"
      defaultExpandedKey="landing"
      pageTitle={{ bn: "নতুন ল্যান্ডিং পেইজ", en: "Create Landing Page" }}
      pageSubtitle={{ bn: "টেমপ্লেট সিলেক্ট করে no-code builder দিয়ে page তৈরি করুন", en: "Pick a template and build a page with the no-code editor" }}
    >
      <LandingPageEditor />
    </UserShell>
  );
}
