import Link from "next/link";
import type { StorefrontHome } from "@/lib/storefront-client";

/** Dark navy footer with address/phone/social + Know Us + Shopping Information columns. */
export default function CaresolutionFooter({ home }: { home: StorefrontHome | null }) {
  return (
    <footer className="mt-10 bg-slate-900 pb-20 pt-10 text-slate-300 md:pb-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold text-white">
            🛒 {home?.shop_name ?? "Shop"}
          </p>
          {home?.phone ? <p className="mt-3 text-sm">{home.phone}</p> : null}
          <div className="mt-4 flex gap-3">
            {["📘", "🐦", "▶️", "📸"].map((icon, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm"
              >
                {icon}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">Know Us</p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/" className="hover:text-white">About Us</Link>
            <Link href="/" className="hover:text-white">Terms &amp; Conditions</Link>
            <Link href="/" className="hover:text-white">Privacy Policy</Link>
            <Link href="/" className="hover:text-white">FAQs</Link>
          </nav>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-white">Shopping Information</p>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/" className="hover:text-white">Refund Policy</Link>
            <Link href="/" className="hover:text-white">Store Locations</Link>
          </nav>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-6xl px-4 text-xs text-slate-500">
        © {new Date().getFullYear()} {home?.shop_name ?? "Shop"}. All Rights Reserved | Powered by BSOL Connect
      </p>
    </footer>
  );
}
