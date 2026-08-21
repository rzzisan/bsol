"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/storefront/product-card";
import {
  fetchCategoriesClient,
  fetchProductsClient,
  type CategorySummary,
  type ProductListResult,
} from "@/lib/storefront-client";

/**
 * Search + browse-all page. Also the practical "view all products" entry
 * point until S5's full homepage ships — /store's placeholder links here.
 *
 * Reads query params via window.location.search (not useSearchParams) to
 * avoid a Suspense boundary — matches the established convention in the
 * public checkout flow (see src/app/terms/page.tsx, .../orders/create/page.tsx).
 */
export default function SearchRoute() {
  const [params, setParams] = useState<{ q: string; category: string; sort: string }>({
    q: "",
    category: "",
    sort: "newest",
  });
  const [input, setInput] = useState("");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [result, setResult] = useState<ProductListResult>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const initial = { q: sp.get("q") ?? "", category: sp.get("category") ?? "", sort: sp.get("sort") ?? "newest" };
    setParams(initial);
    setInput(initial.q);
    fetchCategoriesClient().then((data) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProductsClient({ q: params.q || undefined, category: params.category || undefined, sort: params.sort })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [params]);

  function updateParams(next: Partial<typeof params>) {
    const merged = { ...params, ...next };
    setParams(merged);

    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.category) sp.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);

    window.history.pushState({}, "", `/search${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: input });
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="প্রোডাক্ট খুঁজুন..."
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          খুঁজুন
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={params.category}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={params.sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="newest">নতুন আগে</option>
          <option value="price_asc">দাম: কম থেকে বেশি</option>
          <option value="price_desc">দাম: বেশি থেকে কম</option>
          <option value="name_asc">নাম (A-Z)</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
      ) : result?.data?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>
      )}
    </div>
  );
}
