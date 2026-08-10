"use client";

import { useEffect, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Pause,
  Play,
  X,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

// Phase 1 module scope — staff_team_role_context.md §4. Keep this list in
// sync with StaffPermission::MODULE_KEYS' first five entries; adding a
// Phase-2 module here only requires appending one row + label pair.
const MODULE_KEYS = ["orders", "products", "customers", "courier", "sms"] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

const moduleLabels: Record<Locale, Record<ModuleKey, string>> = {
  bn: { orders: "অর্ডার", products: "পণ্য", customers: "কাস্টমার", courier: "কুরিয়ার", sms: "এসএমএস" },
  en: { orders: "Orders", products: "Products", customers: "Customers", courier: "Courier", sms: "SMS" },
};

const t = {
  bn: {
    heroTitle: "টিম / স্টাফ ম্যানেজমেন্ট",
    heroSubtitle: "আপনার শপের হয়ে অর্ডার/পণ্য/কুরিয়ার সামলানোর জন্য সীমিত-অনুমতির স্টাফ একাউন্ট তৈরি করুন।",
    seatUsage: (used: number, max: number) => `${used} / ${max} স্টাফ ব্যবহৃত`,
    seatUnlimited: (used: number) => `${used} জন স্টাফ (আনলিমিটেড)`,
    seatDisabled: "আপনার বর্তমান প্যাকেজে স্টাফ ফিচার অন্তর্ভুক্ত নেই — প্যাকেজ আপগ্রেড করুন।",
    addStaff: "নতুন স্টাফ যোগ করুন",
    loading: "লোড হচ্ছে...",
    empty: "এখনো কোনো স্টাফ যোগ করা হয়নি।",
    statusActive: "সক্রিয়",
    statusSuspended: "স্থগিত",
    mustChangePassword: "পাসওয়ার্ড এখনো বদলায়নি",
    noPermissions: "কোনো মডিউল অ্যাক্সেস দেওয়া হয়নি",
    edit: "এডিট",
    suspend: "স্থগিত করুন",
    activate: "সক্রিয় করুন",
    resetPassword: "পাসওয়ার্ড রিসেট",
    remove: "মুছে ফেলুন",
    removeConfirm: (name: string) => `"${name}"-কে সরিয়ে দিতে চান? এই স্টাফ আর লগইন করতে পারবে না।`,
    // Add/Edit modal
    modalAddTitle: "নতুন স্টাফ যোগ করুন",
    modalEditTitle: "স্টাফ এডিট করুন",
    fieldName: "নাম",
    fieldEmail: "ইমেইল",
    fieldStatus: "স্ট্যাটাস",
    customPasswordToggle: "নিজে temporary পাসওয়ার্ড দিন (না দিলে অটো-জেনারেট হবে)",
    fieldTempPassword: "Temporary পাসওয়ার্ড",
    permissionsTitle: "মডিউল অ্যাক্সেস",
    cancel: "বাতিল",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    create: "তৈরি করুন",
    creating: "তৈরি হচ্ছে...",
    // credential reveal
    credentialTitle: "স্টাফের লগইন তথ্য",
    credentialNote: "এই পাসওয়ার্ড একবারই দেখানো হবে — এখনই কপি করে স্টাফের সাথে নিরাপদে শেয়ার করুন। প্রথম লগইনে এটি বদলাতে বলা হবে।",
    copy: "কপি করুন",
    copied: "কপি হয়েছে",
    close: "বন্ধ করুন",
    errorGeneric: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
    resetPasswordConfirm: (name: string) => `"${name}"-এর জন্য নতুন temporary পাসওয়ার্ড তৈরি করবেন? পুরনো session সাথে সাথে লগআউট হয়ে যাবে।`,
  },
  en: {
    heroTitle: "Staff & Team Management",
    heroSubtitle: "Create limited-permission staff accounts to help run orders/products/courier for your shop.",
    seatUsage: (used: number, max: number) => `${used} / ${max} staff used`,
    seatUnlimited: (used: number) => `${used} staff members (unlimited)`,
    seatDisabled: "Staff accounts are not included in your current package — upgrade to add team members.",
    addStaff: "Add staff",
    loading: "Loading...",
    empty: "No staff added yet.",
    statusActive: "Active",
    statusSuspended: "Suspended",
    mustChangePassword: "Hasn't changed password yet",
    noPermissions: "No module access granted",
    edit: "Edit",
    suspend: "Suspend",
    activate: "Activate",
    resetPassword: "Reset password",
    remove: "Remove",
    removeConfirm: (name: string) => `Remove "${name}"? This staff member will no longer be able to log in.`,
    modalAddTitle: "Add new staff",
    modalEditTitle: "Edit staff",
    fieldName: "Name",
    fieldEmail: "Email",
    fieldStatus: "Status",
    customPasswordToggle: "Set a custom temporary password (auto-generated if left off)",
    fieldTempPassword: "Temporary password",
    permissionsTitle: "Module access",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    create: "Create",
    creating: "Creating...",
    credentialTitle: "Staff login credentials",
    credentialNote: "This password is shown only once — copy it now and share it securely with the staff member. They'll be required to change it on first login.",
    copy: "Copy",
    copied: "Copied",
    close: "Close",
    errorGeneric: "Something went wrong. Please try again.",
    resetPasswordConfirm: (name: string) => `Generate a new temporary password for "${name}"? Their current session will be logged out immediately.`,
  },
};

type StaffMember = {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  staff_status: "active" | "suspended";
  must_change_password: boolean;
  created_at: string;
  permissions: Record<string, boolean>;
};

type SeatUsage = { used: number; max_staff: number | null };

export default function StaffManagementPage() {
  const [locale] = useState<Locale>(getStoredLocale);

  return (
    <UserShell
      activeKey="staff-management"
      defaultExpandedKey="settings"
      pageTitle={{ bn: "টিম / স্টাফ", en: "Staff & Team" }}
    >
      <StaffManagementContent locale={locale} />
    </UserShell>
  );
}

function StaffManagementContent({ locale }: { locale: Locale }) {
  const tt = t[locale];

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [seatUsage, setSeatUsage] = useState<SeatUsage>({ used: 0, max_staff: null });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [credentialReveal, setCredentialReveal] = useState<{ email: string; password: string } | null>(null);

  async function authedFetch(path: string, options: RequestInit = {}) {
    const token = getStoredToken();
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...(options.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function load() {
    setLoading(true);
    setListError(null);
    const { ok, data } = await authedFetch("/staff");
    if (ok) {
      setStaff(data.staff ?? []);
      setSeatUsage(data.seat_usage ?? { used: 0, max_staff: null });
    } else {
      setListError(data?.message ?? tt.errorGeneric);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seatFull = seatUsage.max_staff !== null && seatUsage.used >= seatUsage.max_staff;
  const seatBlocked = seatUsage.max_staff === 0;

  async function handleToggleStatus(member: StaffMember) {
    setBusyId(member.id);
    const nextStatus = member.staff_status === "active" ? "suspended" : "active";
    const { ok, data } = await authedFetch(`/staff/${member.id}`, {
      method: "PUT",
      body: JSON.stringify({ staff_status: nextStatus }),
    });
    if (ok) {
      setStaff((prev) => prev.map((s) => (s.id === member.id ? data.staff : s)));
    } else {
      alert(data?.message ?? tt.errorGeneric);
    }
    setBusyId(null);
  }

  async function handleResetPassword(member: StaffMember) {
    if (!window.confirm(tt.resetPasswordConfirm(member.name))) return;
    setBusyId(member.id);
    const { ok, data } = await authedFetch(`/staff/${member.id}/reset-password`, { method: "POST" });
    if (ok) {
      setCredentialReveal({ email: member.email, password: data.temp_password });
      void load();
    } else {
      alert(data?.message ?? tt.errorGeneric);
    }
    setBusyId(null);
  }

  async function handleRemove(member: StaffMember) {
    if (!window.confirm(tt.removeConfirm(member.name))) return;
    setBusyId(member.id);
    const { ok, data } = await authedFetch(`/staff/${member.id}`, { method: "DELETE" });
    if (ok) {
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } else {
      alert(data?.message ?? tt.errorGeneric);
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-5 p-4 sm:p-5">
      {/* Hero */}
      <section className="catv-panel p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}
            >
              <Users size={20} />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">{tt.heroTitle}</h1>
              <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">{tt.heroSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={seatBlocked || seatFull}
            title={seatBlocked ? tt.seatDisabled : undefined}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            <UserPlus size={16} /> {tt.addStaff}
          </button>
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          {seatBlocked ? (
            <p className="text-sm font-medium text-amber-600">{tt.seatDisabled}</p>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--muted)]">
                <span>
                  {seatUsage.max_staff === null
                    ? tt.seatUnlimited(seatUsage.used)
                    : tt.seatUsage(seatUsage.used, seatUsage.max_staff)}
                </span>
              </div>
              {seatUsage.max_staff !== null && (
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (seatUsage.used / Math.max(1, seatUsage.max_staff)) * 100)}%`,
                      background: seatFull ? "#f43f5e" : "var(--accent)",
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* List */}
      <section className="catv-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-[var(--muted)]">
            <Loader2 size={16} className="animate-spin" /> {tt.loading}
          </div>
        ) : listError ? (
          <p className="p-6 text-center text-sm text-rose-500">{listError}</p>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-[var(--muted)]">
            <Users size={28} className="opacity-40" />
            {tt.empty}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {staff.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                locale={locale}
                tt={tt}
                busy={busyId === member.id}
                onEdit={() => setEditTarget(member)}
                onToggleStatus={() => handleToggleStatus(member)}
                onResetPassword={() => handleResetPassword(member)}
                onRemove={() => handleRemove(member)}
              />
            ))}
          </ul>
        )}
      </section>

      {addOpen && (
        <StaffFormModal
          mode="create"
          locale={locale}
          tt={tt}
          onClose={() => setAddOpen(false)}
          onSubmit={async (payload) => {
            const { ok, data } = await authedFetch("/staff", { method: "POST", body: JSON.stringify(payload) });
            if (ok) {
              setAddOpen(false);
              setCredentialReveal({ email: payload.email as string, password: data.temp_password as string });
              void load();
            }
            return { ok, message: data?.message, errors: data?.errors };
          }}
        />
      )}

      {editTarget && (
        <StaffFormModal
          mode="edit"
          locale={locale}
          tt={tt}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={async (payload) => {
            const { ok, data } = await authedFetch(`/staff/${editTarget.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
            if (ok) {
              setEditTarget(null);
              setStaff((prev) => prev.map((s) => (s.id === editTarget.id ? data.staff : s)));
            }
            return { ok, message: data?.message, errors: data?.errors };
          }}
        />
      )}

      {credentialReveal && (
        <CredentialRevealModal
          tt={tt}
          email={credentialReveal.email}
          password={credentialReveal.password}
          onClose={() => setCredentialReveal(null)}
        />
      )}
    </div>
  );
}

// ─── Staff row ──────────────────────────────────────────────────────────────

function StaffRow({
  member,
  locale,
  tt,
  busy,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onRemove,
}: {
  member: StaffMember;
  locale: Locale;
  tt: (typeof t)["bn"];
  busy: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onRemove: () => void;
}) {
  const enabledModules = MODULE_KEYS.filter((key) => member.permissions?.[key]);
  const isActive = member.staff_status === "active";

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: "var(--surface-soft)", color: "var(--accent)" }}
        >
          {member.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--foreground)]">{member.name}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {isActive ? tt.statusActive : tt.statusSuspended}
            </span>
            {member.must_change_password && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {tt.mustChangePassword}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-[var(--muted)]">{member.email}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {enabledModules.length === 0 ? (
              <span className="text-[11px] text-[var(--muted)]">{tt.noPermissions}</span>
            ) : (
              enabledModules.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)]"
                >
                  <ShieldCheck size={11} style={{ color: "var(--accent)" }} />
                  {moduleLabels[locale][key]}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <button type="button" onClick={onEdit} disabled={busy} className="catv-chip">
          {tt.edit}
        </button>
        <button type="button" onClick={onResetPassword} disabled={busy} className="catv-chip" title={tt.resetPassword}>
          <KeyRound size={13} />
        </button>
        <button type="button" onClick={onToggleStatus} disabled={busy} className="catv-chip" title={isActive ? tt.suspend : tt.activate}>
          {isActive ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          title={tt.remove}
          className="catv-chip"
          style={{ color: "#f43f5e", borderColor: "color-mix(in srgb, #f43f5e 40%, transparent)" }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ─── Add/Edit modal ─────────────────────────────────────────────────────────

function StaffFormModal({
  mode,
  locale,
  tt,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  locale: Locale;
  tt: (typeof t)["bn"];
  initial?: StaffMember;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: boolean; message?: string; errors?: Record<string, string[]> }>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [status, setStatus] = useState<"active" | "suspended">(initial?.staff_status ?? "active");
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [permissions, setPermissions] = useState<Record<ModuleKey, boolean>>(() => {
    const base = {} as Record<ModuleKey, boolean>;
    MODULE_KEYS.forEach((key) => {
      base[key] = initial?.permissions?.[key] ?? false;
    });
    return base;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> =
      mode === "create"
        ? {
            name: name.trim(),
            email: email.trim(),
            permissions,
            ...(useCustomPassword && tempPassword ? { temp_password: tempPassword } : {}),
          }
        : { name: name.trim(), staff_status: status, permissions };

    const result = await onSubmit(payload);
    setSubmitting(false);
    if (!result.ok) {
      const firstError = result.errors ? Object.values(result.errors)[0]?.[0] : result.message;
      setError(firstError ?? tt.errorGeneric);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-5 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {mode === "create" ? tt.modalAddTitle : tt.modalEditTitle}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{tt.fieldName}</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          {mode === "create" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{tt.fieldEmail}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{tt.fieldStatus}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              >
                <option value="active">{tt.statusActive}</option>
                <option value="suspended">{tt.statusSuspended}</option>
              </select>
            </label>
          )}

          {mode === "create" && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <input type="checkbox" checked={useCustomPassword} onChange={(e) => setUseCustomPassword(e.target.checked)} />
                {tt.customPasswordToggle}
              </label>
              {useCustomPassword && (
                <input
                  type="text"
                  minLength={8}
                  required={useCustomPassword}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder={tt.fieldTempPassword}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              )}
            </div>
          )}

          <div>
            <span className="mb-2 block text-xs font-medium text-[var(--muted)]">{tt.permissionsTitle}</span>
            <div className="grid grid-cols-2 gap-2">
              {MODULE_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <input
                    type="checkbox"
                    checked={permissions[key]}
                    onChange={(e) => setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {moduleLabels[locale][key]}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)]"
            >
              {tt.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? (mode === "create" ? tt.creating : tt.saving) : mode === "create" ? tt.create : tt.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Credential reveal modal ────────────────────────────────────────────────

function CredentialRevealModal({
  tt,
  email,
  password,
  onClose,
}: {
  tt: (typeof t)["bn"];
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — user can still select-and-copy manually
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-[var(--surface)] p-5 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--foreground)]">{tt.credentialTitle}</h2>
        <p className="mt-2 text-xs text-[var(--muted)]">{tt.credentialNote}</p>

        <div className="mt-4 space-y-2 rounded-xl border border-dashed p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <div className="text-xs text-[var(--muted)]">{tt.fieldEmail}</div>
          <div className="break-all text-sm font-semibold text-[var(--foreground)]">{email}</div>
          <div className="mt-2 text-xs text-[var(--muted)]">{tt.fieldTempPassword}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="break-all font-mono text-sm font-semibold text-[var(--foreground)]">{password}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? tt.copied : tt.copy}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {tt.close}
        </button>
      </div>
    </div>
  );
}
