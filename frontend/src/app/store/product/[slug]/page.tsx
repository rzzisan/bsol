import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchHome, fetchProductDetail } from "@/lib/storefront-client";
import ProductDetailView from "@/components/storefront/product-detail-view";
import StorefrontPageTracking from "@/components/storefront/page-tracking";

type RouteProps = { params: Promise<{ slug: string }> };

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
  const product = await fetchProductDetail(baseUrl, slug);

  if (!product) return { title: "Product not found" };

  const description = product.description?.slice(0, 160) || product.name;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.thumbnail ? [{ url: product.thumbnail }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductDetailRoute({ params }: RouteProps) {
  const { slug } = await params;
  const baseUrl = getBaseUrl(await headers());

  const [product, home] = await Promise.all([fetchProductDetail(baseUrl, slug), fetchHome(baseUrl)]);

  if (!product) {
    notFound();
  }

  // JSON-LD (S8) — Product + BreadcrumbList. Next's metadata API has no
  // native structured-data support, so this is a plain inline script tag,
  // the standard pattern for it.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    sku: product.sku ?? undefined,
    image: product.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      price: product.selling_price,
      priceCurrency: "BDT",
      availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count } }
      : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
      ...(product.category
        ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: `${baseUrl}/category/${product.category.slug}` }]
        : []),
      { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name },
    ],
  };

  return (
    <>
      <StorefrontPageTracking
        slug={`store-product-${slug}`}
        viewContentData={{
          content_ids: [product.id],
          content_name: product.name,
          value: Number(product.selling_price),
          currency: "BDT",
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ProductDetailView product={product} home={home} />
    </>
  );
}
