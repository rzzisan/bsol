import Link from "next/link";
import type { CategorySummary, StorefrontHome } from "@/lib/storefront-client";
import FloatingCartButton from "@/components/storefront/floating-cart-button";
import AuthPlaceholderButton from "@/components/storefront/auth-placeholder-button";

/**
 * The original storefront chrome (S4/S5/S6), extracted unchanged out of
 * app/store/layout.tsx so a second template can sit alongside it — see the
 * theme-templates addendum in seller_storefront_context.md.
 */
export default function StandardShell({
  home,
  categories,
  children,
}: {
  home: StorefrontHome | null;
  categories: CategorySummary[] | null;
  children: React.ReactNode;
}) {
  const accent = home?.theme_primary_color || "#0f172a";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold">
            {home?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={home.logo_url} alt={home.shop_name ?? "Shop"} className="h-8 w-8 rounded-full object-cover" />
            ) : null}
            <span className="truncate">{home?.shop_name ?? "Shop"}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/search" className="text-slate-600 hover:text-slate-900">
              সব প্রোডাক্ট
            </Link>
            <Link href="/cart" className="text-slate-600 hover:text-slate-900">
              কার্ট
            </Link>
            <AuthPlaceholderButton />
          </nav>
        </div>

        {categories && categories.length > 0 ? (
          <div className="border-t border-slate-100">
            <div className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 py-2 text-sm">
              {categories.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="whitespace-nowrap text-slate-600 hover:text-slate-900">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold" style={{ color: accent }}>
              {home?.shop_name ?? "Shop"}
            </span>
            <nav className="flex gap-4">
              <Link href="/" className="hover:text-slate-900">হোম</Link>
              <Link href="/search" className="hover:text-slate-900">সব প্রোডাক্ট</Link>
              <Link href="/cart" className="hover:text-slate-900">কার্ট</Link>
            </nav>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            © {new Date().getFullYear()} {home?.shop_name ?? "Shop"}. Powered by BSOL Connect.
          </p>
        </div>
      </footer>

      <FloatingCartButton />
    </div>
  );
}
