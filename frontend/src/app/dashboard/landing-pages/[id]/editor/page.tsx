"use client";

import { useParams } from "next/navigation";
import { LandingPageEditor } from "@/components/landing-page-editor";
import { getStoredToken } from "@/lib/dashboard-client";

export default function LandingPageEditorPage() {
  const params = useParams();
  const pageId = params.id as string;
  const token = getStoredToken();
  
  // Fallback to process.env if getStoredToken returns undefined
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Authentication token not found. Please log in.</p>
      </div>
    );
  }

  return (
    <LandingPageEditor
      pageId={pageId}
      token={token}
      apiBaseUrl={apiBaseUrl}
      onSave={(html, css) => {
        console.log("Page saved", { html, css });
      }}
    />
  );
}
