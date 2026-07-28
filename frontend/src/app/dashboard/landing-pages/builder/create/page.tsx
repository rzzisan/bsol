"use client";

import UserShell from "@/components/user-shell";
import LandingPageBuilder from "@/components/landing-page-builder";

const text: Record<string, Record<string, string>> = {
  bn: {
    title: "নতুন ল্যান্ডিং পেজ (বিল্ডার)",
    subtitle: "ব্লক যোগ করে, সাজিয়ে, স্টাইল দিয়ে একটি ল্যান্ডিং পেজ তৈরি করুন — কোনো কোডিং লাগবে না।",
  },
  en: {
    title: "New Landing Page (Builder)",
    subtitle: "Build a landing page by adding, arranging, and styling blocks — zero coding required.",
  },
};

export default function CreateLandingPageBuilder() {
  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <LandingPageBuilder mode="create" />
    </UserShell>
  );
}
