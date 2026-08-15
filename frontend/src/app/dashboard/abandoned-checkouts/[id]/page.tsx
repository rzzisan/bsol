"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { LANDING_API_BASE } from "@/lib/landing-pages";

const t = {
  bn: {
    back: "← অসম্পূর্ণ অর্ডার তালিকা",
    loading: "লোড হচ্ছে...",
    notFound: "এন্ট্রিটি পাওয়া যায়নি।",
    pageTitle: "অসম্পূর্ণ অর্ডার বিস্তারিত",
    customerInfo: "কাস্টমার তথ্য",
    name: "নাম",
    phone: "ফোন",
    email: "ইমেইল",
    address: "ঠিকানা",
    district: "জেলা",
    thana: "থানা",
    area: "এলাকা",
    notes: "নোট",
    customFields: "কাস্টম ফিল্ড",
    items: "প্রোডাক্ট",
    itemName: "নাম",
    quantity: "পরিমাণ",
    unitPrice: "একক দাম",
    remove: "মুছুন",
    noItems: "কোনো প্রোডাক্ট সিলেক্ট করা হয়নি।",
    subtotal: "সাবটোটাল",
    save: "সংরক্ষণ করুন",
    saving: "সংরক্ষণ হচ্ছে...",
    saved: "সংরক্ষিত হয়েছে!",
    convert: "রিয়েল অর্ডারে কনভার্ট করুন",
    dismiss: "বাতিল করুন",
    reactivate: "পুনরায় চালু করুন",
    delete: "মুছুন",
    confirmDelete: "এই এন্ট্রিটি মুছে ফেলতে চান?",
    copyLink: "রিজিউম লিংক কপি",
    linkCopied: "কপি হয়েছে!",
    status: "স্ট্যাটাস",
    inProgress: "চলমান",
    abandoned: "পরিত্যক্ত",
    converted: "কনভার্টেড",
    dismissed: "বাতিল",
    landingPage: "ল্যান্ডিং পেজ",
    source: "উৎস",
    lastActivity: "সর্বশেষ কার্যকলাপ",
    createdAt: "শুরু হয়েছিল",
    viewOrder: "অর্ডার দেখুন",
    alreadyConverted: "এই checkout ইতিমধ্যে একটি রিয়েল অর্ডারে কনভার্ট হয়ে গেছে।",
    valueRepeat: (n: number) => `${n}টি পূর্বের অর্ডার`,
  },
  en: {
    back: "← Abandoned Checkouts",
    loading: "Loading...",
    notFound: "Entry not found.",
    pageTitle: "Abandoned Checkout Details",
    customerInfo: "Customer Info",
    name: "Name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    district: "District",
    thana: "Thana",
    area: "Area",
    notes: "Notes",
    customFields: "Custom Fields",
    items: "Product(s)",
    itemName: "Name",
    quantity: "Qty",
    unitPrice: "Unit Price",
    remove: "Remove",
    noItems: "No products selected.",
    subtotal: "Subtotal",
    save: "Save Changes",
    saving: "Saving...",
    saved: "Saved!",
    convert: "Convert to Real Order",
    dismiss: "Dismiss",
    reactivate: "Reactivate",
    delete: "Delete",
    confirmDelete: "Delete this entry?",
    copyLink: "Copy resume link",
    linkCopied: "Copied!",
    status: "Status",
    inProgress: "In Progress",
    abandoned: "Abandoned",
    converted: "Converted",
    dismissed: "Dismissed",
    landingPage: "Landing Page",
    source: "Source",
    lastActivity: "Last Activity",
    createdAt: "Started",
    viewOrder: "View Order",
    alreadyConverted: "This checkout has already been converted into a real order.",
    valueRepeat: (n: number) => `${n} past order(s)`,
  },
};

type CheckoutItem = {
  product_id: number;
  product_variant_id?: number | null;
  name: string;
  quantity: number;
  unit_price: number;
  variant_label?: string | null;
  image?: string | null;
};

type AbandonedCheckoutDetail = {
  id: number;
  session_token: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_district: string | null;
  customer_thana: string | null;
  customer_area: string | null;
  notes: string | null;
  custom_fields: Record<string, string> | null;
  items: CheckoutItem[] | null;
  subtotal: string | number | null;
  status: "active" | "converted" | "dismissed";
  is_abandoned: boolean;
  last_activity_at: string;
  created_at: string;
  // snake_case — Eloquent's Model::$snakeAttributes converts relation keys
  // (landingPage()/platformApiKey() method names) to snake_case on
  // serialization, same as regular DB columns.
  landing_page: { id: number; title: string; slug: string; public_url?: string } | null;
  platform_api_key: { id: number; domain: string } | null;
  order: { id: number; order_number: string; status: string } | null;
  customer_value: { total_orders: number; total_spent: number; risk_level: string } | null;
};

export default function AbandonedCheckoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [checkout, setCheckout] = useState<AbandonedCheckoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "", customer_address: "",
    customer_district: "", customer_thana: "", customer_area: "", notes: "",
  });
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [items, setItems] = useState<CheckoutItem[]>([]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        const c: AbandonedCheckoutDetail = d.data;
        setCheckout(c);
        setForm({
          customer_name: c.customer_name ?? "",
          customer_phone: c.customer_phone ?? "",
          customer_email: c.customer_email ?? "",
          customer_address: c.customer_address ?? "",
          customer_district: c.customer_district ?? "",
          customer_thana: c.customer_thana ?? "",
          customer_area: c.customer_area ?? "",
          notes: c.notes ?? "",
        });
        setCustomFields(c.custom_fields ?? {});
        setItems(c.items ?? []);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          custom_fields: customFields,
          items: items.map((i) => ({ product_id: i.product_id, product_variant_id: i.product_variant_id ?? null, quantity: i.quantity })),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      void fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!checkout) return;
    const nextStatus = checkout.status === "dismissed" ? "active" : "dismissed";
    await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    void fetchDetail();
  };

  const handleDelete = async () => {
    if (!window.confirm(txt.confirmDelete)) return;
    await fetch(`${LANDING_API_BASE}/landing/abandoned-checkouts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    router.push("/dashboard/abandoned-checkouts");
  };

  const handleCopyLink = async () => {
    if (!checkout?.landing_page) return;
    // The address comes from the API: landing pages live on their
    // seller's own subdomain, which this dashboard may not be on.
    // Null means the shop has no address yet, so there is no link.
    const base = checkout.landing_page.public_url;
    if (!base) return;
    const link = `${base}?resume=${encodeURIComponent(checkout.session_token)}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateItemQuantity = (productId: number, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.product_id === productId ? { ...i, quantity: Math.max(1, quantity) } : i)));
  };
  const removeItemRow = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const statusLabel = () => {
    if (!checkout) return { text: "", color: "" };
    if (checkout.status === "converted") return { text: txt.converted, color: "bg-emerald-500/15 text-emerald-400" };
    if (checkout.status === "dismissed") return { text: txt.dismissed, color: "bg-slate-500/15 text-[var(--muted)]" };
    if (checkout.is_abandoned) return { text: txt.abandoned, color: "bg-red-500/15 text-red-400" };
    return { text: txt.inProgress, color: "bg-yellow-500/15 text-yellow-400" };
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString(locale === "bn" ? "bn-BD" : "en-US", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  const subtotal = items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);

  if (loading) return (
    <UserShell activeKey="abandoned-checkouts" pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <p className="py-16 text-center text-[var(--muted)]">{txt.loading}</p>
    </UserShell>
  );

  if (!checkout) return (
    <UserShell activeKey="abandoned-checkouts" pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <p className="py-16 text-center text-[var(--muted)]">{txt.notFound}</p>
    </UserShell>
  );

  const s = statusLabel();
  const editable = checkout.status !== "converted";

  return (
    <UserShell activeKey="abandoned-checkouts" pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>
      <Link href="/dashboard/abandoned-checkouts" className="mb-4 inline-block text-sm text-[var(--accent)] hover:underline">
        {txt.back}
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: editable customer + items */}
        <div className="space-y-4 lg:col-span-2">
          <section className="catv-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">{txt.customerInfo}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.text}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.name}</span>
                <input disabled={!editable} value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.phone}</span>
                <input disabled={!editable} value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.email}</span>
                <input disabled={!editable} value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.address}</span>
                <textarea disabled={!editable} rows={2} value={form.customer_address} onChange={(e) => setForm((f) => ({ ...f, customer_address: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.district}</span>
                <input disabled={!editable} value={form.customer_district} onChange={(e) => setForm((f) => ({ ...f, customer_district: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.thana}</span>
                <input disabled={!editable} value={form.customer_thana} onChange={(e) => setForm((f) => ({ ...f, customer_thana: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.area}</span>
                <input disabled={!editable} value={form.customer_area} onChange={(e) => setForm((f) => ({ ...f, customer_area: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.notes}</span>
                <textarea disabled={!editable} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
              </label>
            </div>

            {Object.keys(customFields).length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold text-[var(--muted)]">{txt.customFields}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(customFields).map(([key, value]) => (
                    <label key={key}>
                      <span className="mb-1 block text-xs text-[var(--muted)]">{key}</span>
                      <input disabled={!editable} value={value} onChange={(e) => setCustomFields((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-60" />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="catv-panel p-5">
            <h3 className="mb-4 text-base font-bold">{txt.items}</h3>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">{txt.noItems}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)] uppercase">
                      <th className="px-3 py-2">{txt.itemName}</th>
                      <th className="px-3 py-2 text-center">{txt.quantity}</th>
                      <th className="px-3 py-2 text-right">{txt.unitPrice}</th>
                      {editable && <th className="px-3 py-2 text-right">{txt.remove}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.product_id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {i.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={i.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                            ) : null}
                            <div>
                              <p>{i.name}</p>
                              {i.variant_label ? <p className="text-xs text-[var(--muted)]">{i.variant_label}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            disabled={!editable}
                            value={i.quantity}
                            onChange={(e) => updateItemQuantity(i.product_id, Number(e.target.value))}
                            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-center text-sm disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">৳{Number(i.unit_price).toLocaleString()}</td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeItemRow(i.product_id)} className="text-xs text-red-400 hover:underline">
                              {txt.remove}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-right text-sm font-semibold">{txt.subtotal}: ৳{subtotal.toLocaleString()}</p>
              </div>
            )}
          </section>

          {editable && (
            <div className="flex flex-wrap gap-3">
              <button onClick={handleSave} disabled={saving}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? txt.saving : saved ? txt.saved : txt.save}
              </button>
              <Link href={`/dashboard/orders/create?from_abandoned_checkout=${checkout.id}`}
                className="rounded-xl border border-emerald-500/40 px-5 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10">
                {txt.convert}
              </Link>
            </div>
          )}

          {checkout.status === "converted" && checkout.order && (
            <div className="catv-panel flex items-center justify-between p-4">
              <p className="text-sm text-[var(--muted)]">{txt.alreadyConverted}</p>
              <Link href={`/dashboard/orders/${checkout.order.id}`}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-soft)]">
                {txt.viewOrder} ({checkout.order.order_number})
              </Link>
            </div>
          )}
        </div>

        {/* Right: meta sidebar */}
        <div className="space-y-4">
          <section className="catv-panel p-5">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--muted)]">{txt.source}</dt>
                <dd>{checkout.landing_page?.title ?? checkout.platform_api_key?.domain ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">{txt.createdAt}</dt>
                <dd>{fmtDate(checkout.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">{txt.lastActivity}</dt>
                <dd>{fmtDate(checkout.last_activity_at)}</dd>
              </div>
              {checkout.customer_value && checkout.customer_value.total_orders > 0 && (
                <div>
                  <dt className="text-xs text-[var(--muted)]">{locale === "bn" ? "কাস্টমার হিস্ট্রি" : "Customer History"}</dt>
                  <dd>{txt.valueRepeat(checkout.customer_value.total_orders)} — ৳{Number(checkout.customer_value.total_spent).toLocaleString()}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-col gap-2">
              {checkout.landing_page && (
                <button onClick={handleCopyLink} className="w-full rounded-xl border border-[var(--border)] py-2 text-sm hover:bg-[var(--surface-soft)]">
                  {copied ? txt.linkCopied : txt.copyLink}
                </button>
              )}
              {checkout.status !== "converted" && (
                <button onClick={handleStatusToggle} className="w-full rounded-xl border border-[var(--border)] py-2 text-sm hover:bg-[var(--surface-soft)]">
                  {checkout.status === "dismissed" ? txt.reactivate : txt.dismiss}
                </button>
              )}
              <button onClick={handleDelete} className="w-full rounded-xl border border-red-500/30 py-2 text-sm text-red-400 hover:bg-red-500/10">
                {txt.delete}
              </button>
            </div>
          </section>
        </div>
      </div>
    </UserShell>
  );
}
