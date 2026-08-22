import type { StorefrontHome } from "@/lib/storefront-client";

const TRUST_BADGES = [
  { icon: "↩️", label: "Easy Return Policy" },
  { icon: "🏷️", label: "Best Price Guaranteed" },
  { icon: "✅", label: "100% Authentic" },
  { icon: "🛠️", label: "After-Sales Service" },
  { icon: "🔒", label: "Safe Payments" },
];

/** Banner grid (1 big + up to 2 stacked) + the fixed trust-badge strip. */
export default function CaresolutionHero({ home }: { home: StorefrontHome }) {
  const banners = home.banner_images;
  const [main, ...rest] = banners;
  const stacked = rest.slice(0, 2);

  return (
    <div className="space-y-4">
      {banners.length > 0 ? (
        <div className={`grid gap-3 ${stacked.length > 0 ? "sm:grid-cols-3" : ""}`}>
          <Banner banner={main} className={`h-40 sm:h-64 ${stacked.length > 0 ? "sm:col-span-2" : ""}`} />
          {stacked.length > 0 ? (
            <div className="grid gap-3 sm:h-64 sm:grid-rows-2">
              {stacked.map((b, i) => (
                <Banner key={i} banner={b} className="h-28 sm:h-auto" />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white sm:justify-between sm:overflow-visible">
        {TRUST_BADGES.map((b) => (
          <span key={b.label} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold sm:text-sm">
            <span>{b.icon}</span>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Banner({ banner, className }: { banner: { image_url: string; link_url?: string | null }; className: string }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner.image_url} alt="" className={`w-full rounded-2xl object-cover ${className}`} />
  );
  return banner.link_url ? <a href={banner.link_url}>{img}</a> : img;
}
