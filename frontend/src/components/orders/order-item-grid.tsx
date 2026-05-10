"use client";

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

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
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
                {item.sku ? <p className="text-xs text-[var(--muted)]">SKU: {item.sku}</p> : null}
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
  );
}
