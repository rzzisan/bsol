import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/storefront/product-card";
import { fetchCategories, fetchProductsServer } from "@/lib/storefront-client";
import { paginationRange } from "@/lib/pagination-range";
import StorefrontPageTracking from "@/components/storefront/page-tracking";

type RouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = getBaseUrl(await headers());
  const categories = (await fetchCategories(baseUrl)) ?? [];
  const category = categories.find((c) => c.slug === slug);

  const title = category?.name ?? "Category";
  return { title, openGraph: { title, type: "website" } };
}

export default async function CategoryRoute({ params, searchParams }: RouteProps) {
  const { slug } = await params;
  const { page, sort } = await searchParams;
  const baseUrl = getBaseUrl(await headers());

  const [categories, result] = await Promise.all([
    fetchCategories(baseUrl),
    fetchProductsServer(baseUrl, { category: slug, sort, page: page ? Number(page) : undefined }),
  ]);

  const category = (categories ?? []).find((c) => c.slug === slug);

  if (!category && !result?.data?.length) {
    notFound();
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
      { "@type": "ListItem", position: 2, name: category?.name ?? slug },
    ],
  };

  return (
    <div>
      <StorefrontPageTracking slug={`store-category-${slug}`} viewContent={false} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span className="text-slate-700">{category?.name ?? slug}</span>
      </nav>

      <h1 className="mb-4 text-xl font-bold">{category?.name ?? slug}</h1>

      {result?.data?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">এই ক্যাটাগরিতে এখনো কোনো প্রোডাক্ট নেই।</p>
      )}

      {result?.meta && result.meta.last_page > 1 ? (
        <div className="mt-6 flex justify-center overflow-x-auto">
          <div className="flex flex-nowrap gap-2 text-sm">
            {paginationRange(result.meta.current_page, result.meta.last_page).map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-slate-400">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={`/category/${slug}?page=${n}${sort ? `&sort=${sort}` : ""}`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 ${n === result.meta.current_page ? "bg-slate-900 text-white" : "border border-slate-200"}`}
                >
                  {n}
                </Link>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
