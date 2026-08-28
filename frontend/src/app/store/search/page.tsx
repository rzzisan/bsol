"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/storefront/product-card";
import StorefrontPageTracking from "@/components/storefront/page-tracking";
import { paginationRange } from "@/lib/pagination-range";
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
  const [params, setParams] = useState<{ q: string; category: string; sort: string; page: number }>({
    q: "",
    category: "",
    sort: "newest",
    page: 1,
  });
  const [input, setInput] = useState("");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [result, setResult] = useState<ProductListResult>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const initial = {
      q: sp.get("q") ?? "",
      category: sp.get("category") ?? "",
      sort: sp.get("sort") ?? "newest",
      page: Number(sp.get("page")) || 1,
    };
    setParams(initial);
    setInput(initial.q);
    fetchCategoriesClient().then((data) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProductsClient({ q: params.q || undefined, category: params.category || undefined, sort: params.sort, page: params.page })
      .then(setResult)
      .finally(() => setLoading(false));
    // Every filter/sort/page change starts back at the top of the results.
    window.scrollTo(0, 0);
  }, [params]);

  // Filter/sort changes reset to page 1 (a fresh result set); goToPage()
  // below is the only caller that moves through an existing result set.
  function updateParams(next: Partial<Omit<typeof params, "page">>) {
    const merged = { ...params, ...next, page: 1 };
    setParams(merged);

    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.category) sp.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);

    window.history.pushState({}, "", `/search${sp.toString() ? `?${sp}` : ""}`);
  }

  function goToPage(page: number) {
    const merged = { ...params, page };
    setParams(merged);

    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.category) sp.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);
    if (merged.page > 1) sp.set("page", String(merged.page));

    window.history.pushState({}, "", `/search${sp.toString() ? `?${sp}` : ""}`);
  }

  return (
    <div>
      <StorefrontPageTracking slug="store-search" viewContent={false} />
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

      {!loading && result?.meta && result.meta.last_page > 1 ? (
        <div className="mt-6 flex justify-center overflow-x-auto">
          <div className="flex flex-nowrap gap-2 text-sm">
            {paginationRange(result.meta.current_page, result.meta.last_page).map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 ${n === result.meta.current_page ? "bg-slate-900 text-white" : "border border-slate-200"}`}
                >
                  {n}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
