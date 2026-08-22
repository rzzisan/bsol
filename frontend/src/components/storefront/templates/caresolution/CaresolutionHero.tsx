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
          <div className={`h-40 sm:h-64 ${stacked.length > 0 ? "sm:col-span-2" : ""}`}>
            <Banner banner={main} />
          </div>
          {stacked.length > 0 ? (
            // flex, not grid-rows-2 — self-adjusts to fill the full 256px
            // whether there's 1 or 2 stacked banners, instead of leaving an
            // empty row (1 banner) that a naive h-auto image could then
            // overflow past and visually cover the trust-badge strip below.
            <div className="flex flex-col gap-3 sm:h-64">
              {stacked.map((b, i) => (
                <div key={i} className="h-28 min-h-0 flex-1 sm:h-auto">
                  <Banner banner={b} />
                </div>
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

/** Always fills its wrapper (h-full) — height is controlled by the wrapper, never the image's own aspect ratio. */
function Banner({ banner }: { banner: { image_url: string; link_url?: string | null } }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner.image_url} alt="" className="h-full w-full rounded-2xl object-cover" />
  );
  return banner.link_url ? (
    <a href={banner.link_url} className="block h-full">
      {img}
    </a>
  ) : (
    <div className="h-full">{img}</div>
  );
}
