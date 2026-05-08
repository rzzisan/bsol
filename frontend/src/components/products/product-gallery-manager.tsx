"use client";

type MediaItem = {
  id: number;
  url: string;
  is_primary: boolean;
  sort_order: number;
  file_name?: string | null;
};

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

export default function ProductGalleryManager({
  productId,
  token,
  items,
  onChanged,
}: {
  productId: number;
  token: string;
  items: MediaItem[];
  onChanged: () => Promise<void>;
}) {
  const setThumbnail = async (mediaId: number) => {
    await fetch(`${API}/products/${productId}/media/${mediaId}/set-thumbnail`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    await onChanged();
  };

  const remove = async (mediaId: number) => {
    await fetch(`${API}/products/${productId}/media/${mediaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await onChanged();
  };

  const reorder = async (ids: number[]) => {
    await fetch(`${API}/products/${productId}/media/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order: ids }),
    });
    await onChanged();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    await reorder(next.map((i) => i.id));
  };

  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ordered.map((m, idx) => (
        <div key={m.id} className="rounded-xl border border-[var(--border)] p-2">
          <img src={m.url} alt={m.file_name ?? "product"} className="h-28 w-full rounded-lg object-cover" />
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" onClick={() => void setThumbnail(m.id)} className="rounded border border-[var(--border)] px-2 py-1 text-[10px]">
              {m.is_primary ? "Thumbnail ✓" : "Set Thumbnail"}
            </button>
            <button type="button" onClick={() => void move(idx, -1)} className="rounded border border-[var(--border)] px-2 py-1 text-[10px]">↑</button>
            <button type="button" onClick={() => void move(idx, 1)} className="rounded border border-[var(--border)] px-2 py-1 text-[10px]">↓</button>
            <button type="button" onClick={() => void remove(m.id)} className="rounded border border-red-300 px-2 py-1 text-[10px] text-red-600">Delete</button>
          </div>
        </div>
      ))}
      {ordered.length === 0 ? <p className="text-sm text-[var(--muted)]">No images uploaded.</p> : null}
    </div>
  );
}
