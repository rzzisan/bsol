import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock, Download, Loader2, XCircle } from "lucide-react";

export function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-[var(--foreground)]">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}
      >
        <Icon size={15} />
      </span>
      {children}
    </h3>
  );
}

export function StatusPill({ status, label }: { status: "pending" | "approved" | "rejected"; label: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

// Decorative blurred accent blobs for hero panels — purely visual, absolutely
// positioned inside an `overflow-hidden` + `relative` ancestor.
export function GlowBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--accent) 35%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)" }}
      />
    </>
  );
}

export function ProgressRing({
  percent,
  size = 88,
  strokeWidth = 7,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c - (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

export function ReceiptCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-4 sm:p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
    >
      {children}
    </div>
  );
}

export function ReceiptRow({
  label,
  value,
  tone = "default",
  bold = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "positive";
  bold?: boolean;
}) {
  const labelColor =
    tone === "muted" ? "text-[var(--muted)]" : tone === "positive" ? "text-emerald-600" : "text-[var(--foreground)]";
  const valueColor = tone === "positive" ? "text-emerald-600" : "text-[var(--foreground)]";
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${bold ? "text-base font-bold" : "text-sm"}`}>
      <span className={labelColor}>{label}</span>
      <span className={`tabular-nums font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

export function HistoryRow({
  icon: Icon,
  title,
  subtitle,
  amount,
  status,
  statusLabel,
  onDownload,
  downloading,
  downloadTitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  amount: string;
  status: "pending" | "approved" | "rejected";
  statusLabel: string;
  onDownload: () => void;
  downloading: boolean;
  downloadTitle: string;
}) {
  const barColor = status === "approved" ? "#10b981" : status === "rejected" ? "#f43f5e" : "#f59e0b";
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: barColor }} />
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--surface-soft)" }}
      >
        <Icon size={16} className="text-[var(--muted)]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--foreground)]">{title}</div>
        <div className="text-xs text-[var(--muted)]">{subtitle}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-[var(--foreground)]">{amount}</div>
        <StatusPill status={status} label={statusLabel} />
      </div>
      <button
        type="button"
        title={downloadTitle}
        onClick={onDownload}
        disabled={downloading}
        className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
    </div>
  );
}
