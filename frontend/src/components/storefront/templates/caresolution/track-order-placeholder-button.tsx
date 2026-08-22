"use client";

/**
 * Track Order — UI placeholder only, same treatment as
 * auth-placeholder-button.tsx's Login/Register (confirmed decision: a
 * real phone/order-number lookup is a future feature, not this pass).
 */
export default function TrackOrderPlaceholderButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => alert("অর্ডার ট্র্যাকিং শীঘ্রই আসছে।")}
      className={className ?? "text-sm text-slate-200 hover:text-white"}
    >
      Track Order
    </button>
  );
}
