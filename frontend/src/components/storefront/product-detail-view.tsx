"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/storefront-cart";
import { money, type ProductDetail, type StorefrontHome } from "@/lib/storefront-client";
import { trackAddToCartEvent } from "@/lib/tracking";
import ContactButtons from "@/components/storefront/contact-buttons";
import ReviewsPanel from "@/components/storefront/reviews-panel";

const WISHLIST_KEY = "bsol_storefront_wishlist";

function readWishlist(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type Tab = "specification" | "description" | "rating" | "warranty" | "delivery" | "share";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "specification", label: "Specification" },
  { key: "description", label: "Description" },
  { key: "rating", label: "Rating" },
  { key: "warranty", label: "Warranty" },
  { key: "delivery", label: "Delivery" },
  { key: "share", label: "Share" },
];

export default function ProductDetailView({ product, home }: { product: ProductDetail; home: StorefrontHome | null }) {
  const router = useRouter();
  const { addItem } = useCart();
  const tracking = home?.tracking ?? null;

  const images = product.images.length > 0 ? product.images : product.thumbnail ? [{ id: 0, url: product.thumbnail }] : [];
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>("specification");
  const [message, setMessage] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    setWishlisted(readWishlist().includes(product.id));
  }, [product.id]);

  function toggleWishlist() {
    const current = readWishlist();
    const next = current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id];
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    setWishlisted(next.includes(product.id));
  }

  function handleAddToCart(goToCart: boolean) {
    const result = addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        thumbnail: product.thumbnail,
        unitPrice: Number(product.selling_price),
        productType: product.product_type,
      },
      quantity,
    );

    if (!result.ok) {
      setMessage("একই কার্টে ফিজিক্যাল ও ডিজিটাল প্রোডাক্ট একসাথে যোগ করা যায় না।");
      return;
    }

    trackAddToCartEvent(tracking, `store-product-${product.slug}`, {
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.selling_price) * quantity,
      currency: "BDT",
    });

    if (goToCart) {
      router.push("/checkout");
      return;
    }

    setMessage("কার্টে যোগ হয়েছে।");
    window.setTimeout(() => setMessage(null), 2500);
  }

  const discounted = Number(product.selling_price) < Number(product.regular_price);

  return (
    <div>
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        {product.category ? (
          <>
            /{" "}
            <Link href={`/category/${product.category.slug}`} className="hover:underline">
              {product.category.name}
            </Link>{" "}
          </>
        ) : null}
        / <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {images[activeImage] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeImage].url} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">No image</div>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border ${i === activeImage ? "border-slate-900" : "border-slate-200"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Info panel */}
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{product.name}</h1>
          {product.sku ? <p className="mt-1 text-xs text-slate-400">SKU: {product.sku}</p> : null}

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold" style={home?.theme_primary_color ? { color: home.theme_primary_color } : undefined}>
              {money(product.selling_price)}
            </span>
            {discounted ? <span className="text-base text-slate-400 line-through">{money(product.regular_price)}</span> : null}
          </div>

          {product.features.length > 0 ? (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
              {product.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}

          {product.variants.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {product.variants.map((v) => (
                <span key={v.id} className="rounded-lg border border-slate-200 px-2 py-1">
                  {v.options.map((o) => o.label ?? o.value).join(" / ")}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-slate-500">Quantity</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-lg border border-slate-200">
                −
              </button>
              <span className="w-6 text-center">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="h-8 w-8 rounded-lg border border-slate-200">
                +
              </button>
            </div>
          </div>

          {!product.in_stock ? <p className="mt-3 text-sm font-semibold text-red-500">স্টক নেই</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={toggleWishlist}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${wishlisted ? "border-red-300 bg-red-50 text-red-600" : "border-slate-300 text-slate-700"}`}
            >
              {wishlisted ? "♥ Wishlisted" : "♡ Add to Wishlist"}
            </button>
            <button
              onClick={() => handleAddToCart(false)}
              disabled={!product.in_stock}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add to Cart
            </button>
            <button
              onClick={() => handleAddToCart(true)}
              disabled={!product.in_stock}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: home?.theme_primary_color ?? "#ea580c" }}
            >
              Buy Now
            </button>
          </div>

          {message ? <p className="mt-2 text-xs text-slate-500">{message}</p> : null}

          <div className="mt-4">
            <ContactButtons home={home} productName={product.name} />
          </div>
        </div>
      </div>

      {/* Tabs + sidebar */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm font-medium ${tab === t.key ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-500"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="py-5">
            {tab === "specification" ? (
              product.specifications.length > 0 ? (
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {product.specifications.map((group, gi) => (
                    <div key={gi}>
                      <button
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [gi]: !prev[gi] }))}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-2 text-left text-sm font-semibold"
                      >
                        {group.group}
                        <span>{openGroups[gi] ? "−" : "+"}</span>
                      </button>
                      {openGroups[gi] ? (
                        <table className="w-full text-sm">
                          <tbody>
                            {group.items.map((item, ii) => (
                              <tr key={ii} className="border-t border-slate-100">
                                <td className="w-1/3 px-4 py-1.5 text-slate-500">{item.label}</td>
                                <td className="px-4 py-1.5">{item.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">কোনো স্পেসিফিকেশন যোগ করা হয়নি।</p>
              )
            ) : null}

            {tab === "description" ? (
              <div className="space-y-4">
                <p className="whitespace-pre-line text-sm text-slate-700">{product.description || "কোনো বর্ণনা নেই।"}</p>
                {product.seo_content ? <p className="whitespace-pre-line text-sm text-slate-600">{product.seo_content}</p> : null}
              </div>
            ) : null}

            {tab === "rating" ? (
              <ReviewsPanel
                productSlug={product.slug}
                average={product.rating.average}
                count={product.rating.count}
                reviews={product.reviews}
              />
            ) : null}

            {tab === "warranty" ? (
              <p className="whitespace-pre-line text-sm text-slate-700">{product.warranty_text || "কোনো ওয়ারেন্টি তথ্য নেই।"}</p>
            ) : null}

            {tab === "delivery" ? (
              <p className="whitespace-pre-line text-sm text-slate-700">{product.delivery_text || "কোনো ডেলিভারি তথ্য নেই।"}</p>
            ) : null}

            {tab === "share" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(window.location.href)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                >
                  🔗 Copy Link
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right-rail sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Warranty</h3>
            <p className="mt-1 text-xs text-slate-500">{product.warranty_text || "N/A"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Rating</h3>
            <p className="mt-1 text-xs text-slate-500">
              {product.rating.average.toFixed(1)}/5 ({product.rating.count})
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Delivery</h3>
            <p className="mt-1 text-xs text-slate-500">{product.delivery_text || "N/A"}</p>
          </div>

          {product.related_products.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold">Related Products</h3>
              <div className="space-y-3">
                {product.related_products.slice(0, 4).map((p) => (
                  <Link key={p.id} href={`/product/${p.slug}`} className="flex items-center gap-2">
                    <div className="h-10 w-10 flex-shrink-0 rounded bg-slate-100">
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt={p.name} className="h-full w-full rounded object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{money(p.selling_price)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
