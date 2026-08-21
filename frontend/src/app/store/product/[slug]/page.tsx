import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchHome, fetchProductDetail } from "@/lib/storefront-client";
import ProductDetailView from "@/components/storefront/product-detail-view";

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

  return {
    title: product.name,
    description: product.description?.slice(0, 160) || product.name,
  };
}

export default async function ProductDetailRoute({ params }: RouteProps) {
  const { slug } = await params;
  const baseUrl = getBaseUrl(await headers());

  const [product, home] = await Promise.all([fetchProductDetail(baseUrl, slug), fetchHome(baseUrl)]);

  if (!product) {
    notFound();
  }

  return <ProductDetailView product={product} home={home} />;
}
