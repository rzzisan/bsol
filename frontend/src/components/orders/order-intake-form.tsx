"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/dashboard-client";
import { useLocationDropdowns } from "@/lib/use-location-dropdowns";
import { computeSellingPrice } from "@/lib/pricing";
import OrderItemGrid from "@/components/orders/order-item-grid";
import OrderSummarySticky from "@/components/orders/order-summary-sticky";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

type Product = {
  id: number;
  name: string;
  sku: string | null;
  regular_price: string | null;
  discount: string | null;
  discount_type: "amount" | "percent";
  selling_price: string;
  thumbnail?: string | null;
  track_stock?: boolean;
  stock?: number;
};
type OrderItem = {
  product_id: number | null;
  product_name: string;
  sku: string;
  quantity: number;
  regular_price?: number;
  discount?: number;
  discount_type?: "amount" | "percent";
  unit_price: number;
  track_stock?: boolean;
  stock?: number;
};

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length >= 13) return `0${digits.slice(-10)}`;
  return digits.slice(-11);
};

export default function OrderIntakeForm() {
  const token = getStoredToken();
  const router = useRouter();
  const loc = useLocationDropdowns();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [source, setSource] = useState<"manual" | "facebook_inbox" | "landing_page">("manual");

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online" | "bkash">("cod");
  const [paymentStatus, setPaymentStatus] = useState<"due" | "partial" | "paid">("due");
  const [shippingCharge, setShippingCharge] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("order_form_favorite_products");
      if (stored) return new Set(JSON.parse(stored) as number[]);
    } catch {}
    return new Set();
  });

  const toggleFavorite = (e: MouseEvent, productId: number) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      try { localStorage.setItem("order_form_favorite_products", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`${API}/orders/create/bootstrap`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProducts((data?.data?.products ?? []) as Product[]);
    };
    void run();
  }, [token]);

  useEffect(() => {
    const run = async () => {
      const p = normalizePhone(customerPhone);
      if (p.length < 10) return;
      const res = await fetch(`${API}/customers/lookup-by-phone?phone=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const profile = data?.data?.profile;
      if (!profile) return;
      setCustomerName((prev) => prev || profile.name || "");
      setCustomerAddress((prev) => prev || profile.address || "");
      if (profile.pathao_city_id) {
        void loc.preload(profile.pathao_city_id, profile.pathao_zone_id, profile.pathao_area_id, profile.area);
      }
    };

    const t = setTimeout(() => void run(), 300);
    return () => clearTimeout(t);
  }, [customerPhone, token]);

  const productSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => [p.name, p.sku ?? ""].join(" ").toLowerCase().includes(q))
      : products;
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [products, search, favorites]);

  const addProduct = (p: Product) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === p.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], quantity: clone[idx].quantity + 1 };
        return clone;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku ?? "",
          quantity: 1,
          regular_price: Number(p.regular_price ?? p.selling_price),
          discount: Number(p.discount ?? 0),
          discount_type: p.discount_type ?? "amount",
          unit_price: computeSellingPrice(
            Number(p.regular_price ?? p.selling_price),
            Number(p.discount ?? 0),
            p.discount_type ?? "amount",
          ),
          track_stock: !!p.track_stock,
          stock: p.stock,
        },
      ];
    });
    setSearch("");
  };

  const updateItem = (idx: number, field: keyof OrderItem, value: string | number | boolean | null) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const total = Math.max(0, subtotal + shippingCharge - discount);

  const submit = async () => {
    setError("");
    if (!customerPhone.trim()) {
      setError("Customer phone is required");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one product");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer_phone: customerPhone,
          customer_name: customerName || null,
          customer_address: customerAddress || null,
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
          items: items.map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            sku: i.sku || null,
            quantity: i.quantity,
            regular_price: i.regular_price ?? i.unit_price,
            discount: i.discount ?? 0,
            discount_type: i.discount_type ?? "amount",
            unit_price: i.unit_price,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message ?? Object.values(data?.errors ?? {})?.[0] ?? "Failed to create order";
        setError(Array.isArray(msg) ? String(msg[0]) : String(msg));
        return;
      }

      router.push("/dashboard/orders");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {error ? <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <section className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Customer & Delivery</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone *"
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name"
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address" rows={2}
              className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <select value={loc.cityId} onChange={(e) => loc.setCity(e.target.value ? Number(e.target.value) : "")}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">District</option>
              {loc.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={loc.zoneId} onChange={(e) => loc.setZone(e.target.value ? Number(e.target.value) : "")}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Thana</option>
              {loc.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <select value={loc.areaId} onChange={(e) => loc.setArea(e.target.value ? Number(e.target.value) : "")}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Area</option>
              {loc.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="manual">Manual</option>
              <option value="facebook_inbox">Facebook Inbox</option>
              <option value="landing_page">Landing Page</option>
            </select>
          </div>
        </section>

        <section className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Products & Items</h3>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product by name/SKU"
            className="mb-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          <div className="mb-3 max-h-64 overflow-auto rounded-xl border border-[var(--border)]">
            {productSuggestions.map((p) => (
              <div
                key={p.id}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]"
              >
                {/* Thumbnail + info — click to add product */}
                <button
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[10px] text-[var(--muted)]">
                      No Image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                      {p.sku ? <span>SKU: {p.sku}</span> : null}
                      {typeof p.stock === "number" ? <span>Stock: {p.stock}</span> : null}
                    </div>
                  </div>
                </button>

                {/* Price */}
                <div className="shrink-0 text-right">
                  <p className="font-semibold">৳{computeSellingPrice(
                    Number(p.regular_price ?? p.selling_price),
                    Number(p.discount ?? 0),
                    p.discount_type ?? "amount",
                  ).toLocaleString()}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    ৳{Number(p.regular_price ?? p.selling_price).toLocaleString()} - {p.discount_type === "percent"
                      ? `${Number(p.discount ?? 0).toLocaleString()}%`
                      : `৳${Number(p.discount ?? 0).toLocaleString()}`}
                  </p>
                </div>

                {/* Favorite toggle */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, p.id)}
                  title={favorites.has(p.id) ? "Favorite থেকে সরান" : "Favorite যোগ করুন"}
                  className={`shrink-0 text-xl leading-none transition-colors ${
                    favorites.has(p.id)
                      ? "text-yellow-400 hover:text-yellow-500"
                      : "text-[var(--muted)] hover:text-yellow-400"
                  }`}
                >
                  ★
                </button>
              </div>
            ))}

            {productSuggestions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                {search.trim() ? "No product matched." : "No products available."}
              </p>
            ) : null}
          </div>

          <OrderItemGrid items={items} onUpdate={updateItem} onRemove={removeItem} />
        </section>

        <section className="catv-panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Payment & Notes</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="cod">COD</option>
              <option value="online">Online</option>
              <option value="bkash">Bkash</option>
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as typeof paymentStatus)}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="due">Due</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <input type="number" min={0} value={shippingCharge} onChange={(e) => setShippingCharge(Number(e.target.value))}
              placeholder="Shipping charge" className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="Discount" className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes"
              className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </div>
        </section>
      </div>

      <OrderSummarySticky subtotal={subtotal} shipping={shippingCharge} discount={discount} total={total} onSubmit={submit} submitting={submitting} />
    </div>
  );
}
