"use client";

import { useRef, useState } from "react";

type MediaPolicy = {
  max_gallery_images: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

export default function ProductMediaUploader({
  productId,
  token,
  policy,
  onUploaded,
}: {
  productId: number;
  token: string;
  policy: MediaPolicy | null;
  onUploaded: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setError("");
    if (policy) {
      const maxBytes = policy.max_file_size_mb * 1024 * 1024;
      for (const f of files) {
        if (!policy.allowed_mime_types.includes(f.type)) {
          setError(`Unsupported type: ${f.type}`);
          return;
        }
        if (f.size > maxBytes) {
          setError(`File too large: ${f.name}`);
          return;
        }
      }
    }

    const form = new FormData();
    files.forEach((f) => form.append("files[]", f));

    setUploading(true);
    try {
      const res = await fetch(`${API}/products/${productId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Upload failed");
        return;
      }
      await onUploaded();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {uploading ? "Uploading..." : "Upload Images"}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
