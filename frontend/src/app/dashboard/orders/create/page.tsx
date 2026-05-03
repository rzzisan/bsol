"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";
import { useLocationDropdowns } from "@/lib/use-location-dropdowns";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "নতুন অর্ডার",
    step1: "গ্রাহকের তথ্য",
    step2: "পণ্য যোগ করুন",
    step3: "পেমেন্ট ও শিপিং",
    next: "পরবর্তী",
    back: "পেছনে",
    submit: "অর্ডার তৈরি করুন",
    submitting: "তৈরি হচ্ছে...",
    // step 1
    customerPhone: "ফোন নম্বর *",
    customerName: "নাম",
    customerAddress: "ঠিকানা",
    customerDistrict: "জেলা",
    customerThana: "থানা / উপজেলা",
    customerArea: "এলাকা",
    selectCity: "-- জেলা সিলেক্ট করুন --",
    selectZone: "-- উপজেলা সিলেক্ট করুন --",
    selectArea: "-- এলাকা সিলেক্ট করুন --",
    source: "উৎস",
    // step 2
    searchProduct: "পণ্য খুঁজুন...",
    addItem: "যোগ করুন",
    noItems: "কোনো পণ্য যোগ করা হয়নি।",
    itemName: "পণ্য",
    qty: "পরিমাণ",
    price: "একক মূল্য",
    itemTotal: "মোট",
    remove: "বাদ দিন",
    subtotal: "সাব-টোটাল",
    // step 3
    shippingCharge: "শিপিং চার্জ (৳)",
    discount: "ছাড় (৳)",
    paymentMethod: "পেমেন্ট পদ্ধতি",
    paymentStatus: "পেমেন্ট স্ট্যাটাস",
    notes: "নোট",
    orderTotal: "অর্ডার মোট",
    cod: "ক্যাশ অন ডেলিভারি",
    online: "অনলাইন ট্রান্সফার",
    bkash: "বিকাশ",
    due: "বাকি",
    partial: "আংশিক",
    paid: "পেইড",
    manual: "ম্যানুয়াল",
    facebook_inbox: "ফেসবুক ইনবক্স",
    landing_page: "ল্যান্ডিং পেজ",
    required: "এই মাঠটি আবশ্যক।",
    itemRequired: "কমপক্ষে একটি পণ্য যোগ করুন।",
    sharedLookupLoading: "ফোন থেকে গ্রাহক তথ্য খোঁজা হচ্ছে...",
    sharedLookupFound: "শেয়ারড নেটওয়ার্ক থেকে তথ্য পাওয়া গেছে — অটো-ফিল করা হয়েছে।",
    sharedLookupMeta: "মোট অর্ডার: {orders}, বিক্রেতা: {sellers}",
  },
  en: {
    pageTitle: "New Order",
    step1: "Customer Info",
    step2: "Add Products",
    step3: "Payment & Shipping",
    next: "Next",
    back: "Back",
    submit: "Create Order",
    submitting: "Creating...",
    customerPhone: "Phone *",
    customerName: "Name",
    customerAddress: "Address",
    customerDistrict: "District",
    customerThana: "Thana / Upazila",
    customerArea: "Area",
    selectCity: "-- Select District --",
    selectZone: "-- Select Upazila --",
    selectArea: "-- Select Area --",
    source: "Source",
    searchProduct: "Search product...",
    addItem: "Add",
    noItems: "No products added yet.",
    itemName: "Product",
    qty: "Qty",
    price: "Unit Price",
    itemTotal: "Total",
    remove: "Remove",
    subtotal: "Subtotal",
    shippingCharge: "Shipping Charge (৳)",
    discount: "Discount (৳)",
    paymentMethod: "Payment Method",
    paymentStatus: "Payment Status",
    notes: "Notes",
    orderTotal: "Order Total",
    cod: "Cash on Delivery",
    online: "Online Transfer",
    bkash: "Bkash",
    due: "Due",
    partial: "Partial",
    paid: "Paid",
    manual: "Manual",
    facebook_inbox: "Facebook Inbox",
    landing_page: "Landing Page",
    required: "This field is required.",
    itemRequired: "Add at least one product.",
    sharedLookupLoading: "Looking up customer by phone...",
    sharedLookupFound: "Shared network data found — fields auto-filled.",
    sharedLookupMeta: "Total orders: {orders}, sellers: {sellers}",
  },
};

type ProductSearchResult = { id: number; name: string; sku: string | null; selling_price: string; unit: string };
type OrderItem = { product_id: number | null; product_name: string; sku: string; quantity: number; unit_price: number };
type SharedLookupResponse = {
  found: boolean;
  profile: {
    name: string | null;
    address: string | null;
    district: string | null;
    thana: string | null;
    area: string | null;
    pathao_city_id: number | null;
    pathao_zone_id: number | null;
    pathao_area_id: number | null;
  } | null;
  shared: {
    total_orders: number;
    seller_count: number;
  };
};

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length >= 13) {
    return `0${digits.slice(-10)}`;
  }
  return digits.slice(-11);
};

export default function CreateOrderPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const router = useRouter();
  const token = getStoredToken();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const loc = useLocationDropdowns();
  const [source, setSource] = useState<"manual" | "facebook_inbox" | "landing_page">("manual");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<SharedLookupResponse | null>(null);

  // Step 2
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Step 3
  const [shippingCharge, setShippingCharge] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online" | "bkash">("cod");
  const [paymentStatus, setPaymentStatus] = useState<"due" | "partial" | "paid">("due");
  const [notes, setNotes] = useState("");

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const orderTotal = Math.max(0, subtotal + shippingCharge - discount);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API}/products?search=${encodeURIComponent(q)}&status=active&per_page=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSearchResults(d.data ?? []);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [token]);

  const lookupCustomerByPhone = useCallback(async (rawPhone: string) => {
    const p = normalizePhone(rawPhone);
    if (p.length < 10) {
      setLookupInfo(null);
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(`${API}/customers/lookup-by-phone?phone=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const info: SharedLookupResponse | undefined = data?.data;
      if (!info) return;

      setLookupInfo(info);

      if (info.found && info.profile) {
        setName(info.profile.name ?? "");
        setAddress(info.profile.address ?? "");
        // Preload city/zone/area dropdowns if pathao IDs available
        if (info.profile.pathao_city_id) {
          void loc.preload(
            info.profile.pathao_city_id,
            info.profile.pathao_zone_id,
            info.profile.pathao_area_id,
            info.profile.area,
          );
        }
      }
    } finally {
      setLookupLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts]);

  useEffect(() => {
    const t = setTimeout(() => void lookupCustomerByPhone(phone), 250);
    return () => clearTimeout(t);
  }, [phone, lookupCustomerByPhone]);

  const lookupMeta = useMemo(() => {
    if (!lookupInfo?.shared) return "";
    const template = txt.sharedLookupMeta;
    return template
      .replace("{orders}", String(lookupInfo.shared.total_orders ?? 0))
      .replace("{sellers}", String(lookupInfo.shared.seller_count ?? 0));
  }, [lookupInfo, txt.sharedLookupMeta]);

  const addProduct = (p: ProductSearchResult) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: p.id, product_name: p.name, sku: p.sku ?? "", quantity: 1, unit_price: Number(p.selling_price) }];
    });
    setProductSearch("");
    setSearchResults([]);
  };

  const updateItem = (idx: number, field: keyof OrderItem, value: number | string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const goNext = () => {
    setError("");
    if (step === 1) {
      if (!phone.trim()) { setError(txt.required); return; }
      setStep(2);
    } else if (step === 2) {
      if (items.length === 0) { setError(txt.itemRequired); return; }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_phone: phone,
          customer_name: name || null,
          customer_address: address || null,
          customer_district: loc.cityName || null,
          customer_thana: loc.zoneName || null,
          customer_area: loc.areaName || null,
          pathao_city_id: loc.cityId || null,
          pathao_zone_id: loc.zoneId || null,
          pathao_area_id: loc.areaId || null,
          source,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          shipping_charge: shippingCharge,
          discount,
          notes: notes || null,
          items: items.map(i => ({
            product_id: i.product_id,
            product_name: i.product_name,
            sku: i.sku || null,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message ?? Object.values(data.errors ?? {})[0];
        setError(Array.isArray(msg) ? msg[0] : String(msg));
        return;
      }
      router.push("/dashboard/orders");
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel = [txt.step1, txt.step2, txt.step3];

  return (
    <UserShell activeKey="create-order" defaultExpandedKey="orders"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {/* Stepper */}
      <div className="mb-6 flex gap-2">
        {[1,2,3].map(s => (
          <div key={s} className="flex-1 text-center">
            <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors
              ${step === s ? "bg-[var(--accent)] text-white" : step > s ? "bg-emerald-500 text-white" : "bg-[var(--surface)] text-[var(--muted)]"}`}>
              {step > s ? "✓" : s}
            </div>
            <p className={`text-xs ${step === s ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{stepLabel[s-1]}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

      <div className="catv-panel p-6">
        {/* ── Step 1: Customer ── */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerPhone}</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              {lookupLoading && (
                <p className="mt-1 text-[11px] text-[var(--muted)]">{txt.sharedLookupLoading}</p>
              )}
              {!lookupLoading && lookupInfo?.found && (
                <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
                  <p className="text-[11px] font-medium text-emerald-400">{txt.sharedLookupFound}</p>
                  <p className="text-[11px] text-emerald-300/90">{lookupMeta}</p>
                </div>
              )}
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerName}</span>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerAddress}</span>
              <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerDistrict}</span>
              <select
                value={loc.cityId}
                onChange={e => loc.setCity(e.target.value ? Number(e.target.value) : "")}
                disabled={loc.loadingCities || loc.cities.length === 0}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                <option value="">{loc.loadingCities ? "লোড হচ্ছে..." : txt.selectCity}</option>
                {loc.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerThana}</span>
              <select
                value={loc.zoneId}
                onChange={e => loc.setZone(e.target.value ? Number(e.target.value) : "")}
                disabled={!loc.cityId || loc.loadingZones}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                <option value="">{loc.loadingZones ? "লোড হচ্ছে..." : txt.selectZone}</option>
                {loc.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.customerArea}</span>
              <select
                value={loc.areaId}
                onChange={e => loc.setArea(e.target.value ? Number(e.target.value) : "")}
                disabled={!loc.zoneId || loc.loadingAreas}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                <option value="">{loc.loadingAreas ? "লোড হচ্ছে..." : txt.selectArea}</option>
                {loc.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.source}</span>
              <select value={source} onChange={e => setSource(e.target.value as typeof source)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="manual">{txt.manual}</option>
                <option value="facebook_inbox">{txt.facebook_inbox}</option>
                <option value="landing_page">{txt.landing_page}</option>
              </select>
            </label>
          </div>
        )}

        {/* ── Step 2: Products ── */}
        {step === 2 && (
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder={txt.searchProduct}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              {(searchResults.length > 0 || searchLoading) && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden">
                  {searchLoading ? (
                    <p className="px-3 py-2 text-xs text-[var(--muted)]">{txt.searchProduct}</p>
                  ) : searchResults.map(p => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]">
                      <span>{p.name} {p.sku ? <span className="text-xs text-[var(--muted)]">({p.sku})</span> : null}</span>
                      <span className="font-semibold text-[var(--accent)]">৳{Number(p.selling_price).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--muted)]">{txt.noItems}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="text-xs text-[var(--muted)] uppercase border-b border-[var(--border)]">
                      <th className="px-2 py-2 text-left">{txt.itemName}</th>
                      <th className="px-2 py-2 text-center w-20">{txt.qty}</th>
                      <th className="px-2 py-2 text-right w-28">{txt.price}</th>
                      <th className="px-2 py-2 text-right w-24">{txt.itemTotal}</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)]">
                        <td className="px-2 py-2">{item.product_name}</td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-center text-xs outline-none focus:border-[var(--accent)]" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", Number(e.target.value))}
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent)]" />
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">৳{(item.quantity * item.unit_price).toLocaleString()}</td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="px-2 py-2 text-right text-xs text-[var(--muted)]">{txt.subtotal}</td>
                      <td className="px-2 py-2 text-right font-bold">৳{subtotal.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Payment & Shipping ── */}
        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.paymentMethod}</span>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="cod">{txt.cod}</option>
                <option value="online">{txt.online}</option>
                <option value="bkash">{txt.bkash}</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.paymentStatus}</span>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as typeof paymentStatus)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="due">{txt.due}</option>
                <option value="partial">{txt.partial}</option>
                <option value="paid">{txt.paid}</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.shippingCharge}</span>
              <input type="number" min="0" value={shippingCharge} onChange={e => setShippingCharge(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.discount}</span>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.notes}</span>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none" />
            </label>
            {/* Summary */}
            <div className="sm:col-span-2 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 p-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--muted)]">{txt.subtotal}</span>
                <span>৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--muted)]">{txt.shippingCharge}</span>
                <span>+ ৳{shippingCharge.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--muted)]">{txt.discount}</span>
                <span className="text-emerald-400">− ৳{discount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold">
                <span>{txt.orderTotal}</span>
                <span className="text-[var(--accent)] text-lg">৳{orderTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-4 flex justify-between">
        {step > 1 ? (
          <button onClick={() => setStep(s => (s - 1) as 1|2|3)}
            className="rounded-xl border border-[var(--border)] px-5 py-2 text-sm hover:bg-[var(--surface-soft)]">
            {txt.back}
          </button>
        ) : <div />}
        {step < 3 ? (
          <button onClick={goNext}
            className="rounded-xl bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90">
            {txt.next}
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="rounded-xl bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? txt.submitting : txt.submit}
          </button>
        )}
      </div>
    </UserShell>
  );
}
