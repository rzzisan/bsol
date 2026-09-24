"use client";

type OrderItem = {
  product_id: number | null;
  product_variant_id?: number | null;
  product_name: string;
  sku: string;
  quantity: number;
  regular_price?: number;
  discount?: number;
  discount_type?: "amount" | "percent";
  unit_price: number;
  track_stock?: boolean;
  stock?: number;
  variant_info?: Record<string, unknown> | null;
};

export default function OrderItemGrid({
  items,
  onUpdate,
  onRemove,
}: {
  items: OrderItem[];
  onUpdate: (idx: number, field: keyof OrderItem, value: string | number | boolean | null) => void;
  onRemove: (idx: number) => void;
}) {
  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">No products added yet.</p>;
  }

  const meta = (item: OrderItem) => (
    <>
      {item.sku ? <p className="text-xs text-[var(--muted)]">SKU: {item.sku}</p> : null}
      {item.variant_info && Object.keys(item.variant_info).length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          {Object.entries(item.variant_info).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
        </p>
      ) : null}
      {typeof item.regular_price === "number" ? (
        <p className="text-xs text-[var(--muted)]">
          Regular: ৳{item.regular_price.toLocaleString()} · Discount: {item.discount_type === "percent"
            ? `${Number(item.discount ?? 0).toLocaleString()}%`
            : `৳${Number(item.discount ?? 0).toLocaleString()}`}
        </p>
      ) : null}
      {item.track_stock && typeof item.stock === "number" ? (
        <p className={`text-xs ${item.stock < item.quantity ? "text-red-500" : "text-[var(--muted)]"}`}>Stock: {item.stock}</p>
      ) : null}
    </>
  );

  return (
    <>
      {/* Mobile: one card per item — a 5-column table forces sideways scrolling on a phone. */}
      <div className="space-y-2 md:hidden">
        {items.map((item, idx) => (
          <div key={`${item.product_id ?? "x"}-${idx}`} className="rounded-xl border border-[var(--border)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{item.product_name}</p>
                {meta(item)}
              </div>
              <button type="button" onClick={() => onRemove(idx)} className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-600">Remove</button>
            </div>
            <div className="mt-2 grid grid-cols-3 items-end gap-2">
              <label className="text-xs text-[var(--muted)]">
                Qty
                <input type="number" min={1} value={item.quantity} onChange={(e) => onUpdate(idx, "quantity", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]" />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Price
                <input type="number" min={0} value={item.unit_price} onChange={(e) => onUpdate(idx, "unit_price", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]" />
              </label>
              <p className="pb-1.5 text-right text-sm font-semibold">৳{(item.quantity * item.unit_price).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`${item.product_id ?? "x"}-${idx}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{item.product_name}</p>
                  {meta(item)}
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={1} value={item.quantity} onChange={(e) => onUpdate(idx, "quantity", Number(e.target.value))}
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} value={item.unit_price} onChange={(e) => onUpdate(idx, "unit_price", Number(e.target.value))}
                    className="w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1" />
                </td>
                <td className="px-3 py-2 font-semibold">৳{(item.quantity * item.unit_price).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onRemove(idx)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
