"use client";

import { useParams } from "next/navigation";
import UserShell from "@/components/user-shell";
import LandingPageBuilder from "@/components/landing-page-builder";

const text: Record<string, Record<string, string>> = {
  bn: {
    title: "ল্যান্ডিং পেজ বিল্ডার",
    subtitle: "ব্লক ড্র্যাগ করে সাজান, স্টাইল দিন — কোনো কোডিং লাগবে না।",
  },
  en: {
    title: "Landing Page Builder",
    subtitle: "Drag blocks to reorder, apply styles — zero coding required.",
  },
};

export default function EditLandingPageBuilder() {
  const params = useParams<{ id: string }>();
  const pageId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{ bn: text.bn.title, en: text.en.title }}
      pageSubtitle={{ bn: text.bn.subtitle, en: text.en.subtitle }}
    >
      <LandingPageBuilder mode="edit" pageId={pageId} />
    </UserShell>
  );
}
