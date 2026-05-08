"use client";

type MediaPolicy = {
  max_gallery_images: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
};

export default function MediaPolicyHint({ policy }: { policy: MediaPolicy | null }) {
  if (!policy) return null;

  return (
    <p className="text-xs text-[var(--muted)]">
      Max {policy.max_gallery_images} images, {policy.max_file_size_mb}MB each, {policy.allowed_mime_types.join(", ")}
    </p>
  );
}
