"use client";

// Renderers for the individual landing page block types. Shared by the
// public page and the builder's live preview (through PublicLandingPageView).
import { useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import type { JSONContent } from "@tiptap/core";
import { resolveBlockIcon } from "@/lib/block-icons";
import { renderTiptapJSON } from "@/lib/rich-text-render";

// Seller-authored content (rich-text blocks, raw HTML sections) is rendered
// via dangerouslySetInnerHTML on this public, unauthenticated checkout page —
// sanitize it at the render boundary so a compromised/malicious seller
// account can't inject a script or a javascript: link that runs in every
// visitor's browser.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}

export type CarouselImage = {
  id?: number | null;
  url?: string | null;
  alt?: string | null;
};

export type CarouselBlock = {
  title?: string | null;
  template?: string | null;
  images?: CarouselImage[];
};

export function CarouselBlockView({
  block,
  theme,
}: {
  block: CarouselBlock;
  theme: {
    primary: string;
  };
}) {
  const images = (block.images ?? []).filter((img) => Boolean(img?.url?.trim()));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length, images.map((img) => img.url).join("|")]);

  useEffect(() => {
    if (images.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const template = block.template === "style-2" ? "style-2" : "style-1";
  const slideHeight = template === "style-2" ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[4/3] sm:aspect-[16/9]";

  function goTo(index: number) {
    setActiveIndex((index + images.length) % images.length);
  }

  function getCoverflowStyle(imageIndex: number) {
    const total = images.length;
    const rawOffset = imageIndex - activeIndex;
    const offset = ((rawOffset % total) + total) % total;
    const signedOffset = offset > total / 2 ? offset - total : offset;
    const absOffset = Math.abs(signedOffset);

    if (absOffset > 2) {
      return {
        opacity: 0,
        transform: "translate3d(0, 0, -1200px) scale(0.65)",
        zIndex: 0,
        pointerEvents: "none" as const,
      };
    }

    const translateX = signedOffset * 34;
    const translateZ = absOffset === 0 ? 0 : -Math.max(120, absOffset * 120);
    const rotateY = signedOffset * -34;
    const scale = absOffset === 0 ? 1 : absOffset === 1 ? 0.93 : 0.84;
    const opacity = absOffset === 0 ? 1 : absOffset === 1 ? 0.95 : 0.75;

    return {
      opacity,
      transform: `translate3d(${translateX}%, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      zIndex: 20 - absOffset,
      pointerEvents: absOffset === 0 ? "auto" as const : "none" as const,
    };
  }

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}

      {template === "style-2" ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-6 sm:px-6 sm:py-10">
          <div className="relative mx-auto flex min-h-[15rem] w-full items-center justify-center perspective-[1600px] sm:min-h-[18rem]">
            {images.map((image, imageIndex) => {
              const isActive = imageIndex === activeIndex;
              const style = getCoverflowStyle(imageIndex);

              return (
                <button
                  key={`${image.url}-${imageIndex}`}
                  type="button"
                  onClick={() => goTo(imageIndex)}
                  aria-label={`Go to slide ${imageIndex + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  className="absolute left-1/2 top-1/2 w-[88%] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out focus:outline-none sm:w-[72%]"
                  style={{
                    ...style,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="overflow-hidden rounded-2xl bg-slate-50 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async"
                      src={image.url ?? ""}
                      alt={image.alt || `Carousel image ${imageIndex + 1}`}
                      className="h-[12rem] w-full object-contain sm:h-[22rem] sm:object-cover"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                </button>
              );
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white"
              >
                <span className="block text-xl leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-slate-700 shadow-xl transition hover:bg-white"
              >
                <span className="block text-xl leading-none">›</span>
              </button>
            </>
          ) : null}

          {images.length > 1 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {images.map((image, imageIndex) => (
                <button
                  key={`${image.url}-dot-${imageIndex}`}
                  type="button"
                  aria-label={`Go to slide ${imageIndex + 1}`}
                  onClick={() => goTo(imageIndex)}
                  className={`h-2.5 rounded-full transition-all ${imageIndex === activeIndex ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-3 text-center text-xs text-slate-500">
            {activeIndex + 1} / {images.length}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className={`relative w-full ${slideHeight}`}>
            {images.map((image, imageIndex) => {
              const isActive = imageIndex === activeIndex;
              return (
                <div
                  key={`${image.url}-${imageIndex}`}
                  className={`absolute inset-0 transition-all duration-700 ease-out ${isActive ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"}`}
                  aria-hidden={!isActive}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async"
                    src={image.url ?? ""}
                    alt={image.alt || `Carousel image ${imageIndex + 1}`}
                    className="h-full w-full object-contain sm:object-cover"
                  />
                </div>
              );
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
              >
                <span className="block text-xl leading-none">‹</span>
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
              >
                <span className="block text-xl leading-none">›</span>
              </button>
            </>
          ) : null}
        </div>
      )}

      {template === "style-1" && images.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {images.map((image, imageIndex) => (
            <button
              key={`${image.url}-dot-${imageIndex}`}
              type="button"
              aria-label={`Go to slide ${imageIndex + 1}`}
              onClick={() => goTo(imageIndex)}
              className={`h-2.5 rounded-full transition-all ${imageIndex === activeIndex ? "w-6 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>
      ) : null}

      {template === "style-1" ? (
        <div className="mt-2 text-center text-xs text-slate-500">
          {activeIndex + 1} / {images.length}
        </div>
      ) : null}
    </div>
  );
}

export function RichTextBlockView({ block, theme }: { block: { title?: string | null; body?: unknown }; theme: { primary: string } }) {
  const html = useMemo(() => renderTiptapJSON(block.body as JSONContent | null | undefined), [block.body]);

  if (!block.title && !html) return null;

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}
      <div className="lp-html lp-rich-text max-w-none text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
    </div>
  );
}

export function ImageTextBlockView({
  block,
  theme,
}: {
  block: { image_url?: string | null; image_position?: string | null; heading?: string | null; body?: string | null; cta_text?: string | null; cta_url?: string | null };
  theme: { primary: string; accent: string; buttonText: string };
}) {
  if (!block.image_url && !block.heading && !block.body) return null;
  const imageRight = block.image_position === "right";

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <div className={`grid items-center gap-6 md:grid-cols-2 ${imageRight ? "" : "md:[&>*:first-child]:order-2"}`}>
        <div>
          {block.heading ? <h2 className="text-2xl font-bold" style={{ color: theme.primary }}>{block.heading}</h2> : null}
          {block.body ? <p className="mt-3 text-sm leading-7 text-slate-600">{block.body}</p> : null}
          {block.cta_text ? (
            <a href={block.cta_url || "#checkout"} className="mt-5 inline-flex rounded-2xl px-5 py-2.5 text-sm font-semibold shadow" style={{ backgroundColor: theme.accent, color: theme.buttonText }}>
              {block.cta_text}
            </a>
          ) : null}
        </div>
        {block.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={block.image_url} alt={block.heading || ""} className="w-full rounded-2xl object-cover" />
        ) : null}
      </div>
    </div>
  );
}

export function TrustBadgeRow({
  badges,
  layout,
  theme,
}: {
  badges: Array<{ icon?: string | null; label?: string | null; sublabel?: string | null }>;
  layout?: "cards" | "row" | "minimal" | null;
  theme: { primary: string };
}) {
  if (badges.length === 0) return null;

  if (layout === "row") {
    return (
      <div className="lp-card flex flex-wrap items-center justify-center gap-3 rounded-3xl p-6 sm:gap-4 sm:p-8">
        {badges.map((badge, index) => {
          const Icon = resolveBlockIcon(badge.icon);
          return (
            <div key={`trust-${index}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
              <Icon size={18} className="shrink-0 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">{badge.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === "minimal") {
    return (
      <div className="lp-card grid gap-6 rounded-3xl p-6 text-center sm:grid-cols-3 sm:p-8">
        {badges.map((badge, index) => {
          const Icon = resolveBlockIcon(badge.icon);
          return (
            <div key={`trust-${index}`} className="flex flex-col items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.primary}1a` }}>
                <Icon size={22} style={{ color: theme.primary }} />
              </span>
              <div className="text-sm font-semibold text-slate-900">{badge.label}</div>
              {badge.sublabel ? <div className="text-xs text-slate-500">{badge.sublabel}</div> : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lp-card grid gap-3 rounded-3xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
      {badges.map((badge, index) => {
        const Icon = resolveBlockIcon(badge.icon);
        return (
          <div key={`trust-${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Icon size={22} className="shrink-0 text-slate-700" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{badge.label}</div>
              {badge.sublabel ? <div className="truncate text-xs text-slate-500">{badge.sublabel}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FeatureGrid({
  features,
  title,
  fallbackTitle,
  layout,
  theme,
}: {
  features: Array<{ title?: string | null; description?: string | null; icon?: string | null }>;
  title?: string | null;
  fallbackTitle: string;
  layout?: "cards" | "list" | "minimal" | null;
  theme: { primary: string };
}) {
  if (features.length === 0) return null;

  if (layout === "list") {
    return (
      <div className="lp-card rounded-3xl p-6 sm:p-8">
        <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>{title || fallbackTitle}</h2>
        <div className="divide-y divide-slate-200">
          {features.map((feature, index) => {
            const Icon = resolveBlockIcon(feature.icon);
            return (
              <div key={`${feature.title ?? "feature"}-${index}`} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                {feature.icon ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme.primary}1a` }}>
                    <Icon size={20} style={{ color: theme.primary }} />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">{feature.title || `Feature ${index + 1}`}</h3>
                  {feature.description ? <p className="mt-1 text-sm text-slate-600">{feature.description}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (layout === "minimal") {
    return (
      <div className="lp-card rounded-3xl p-6 sm:p-8">
        <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>{title || fallbackTitle}</h2>
        <div className="grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = resolveBlockIcon(feature.icon);
            return (
              <div key={`${feature.title ?? "feature"}-${index}`} className="flex flex-col items-center gap-2">
                {feature.icon ? (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.primary}1a` }}>
                    <Icon size={26} style={{ color: theme.primary }} />
                  </span>
                ) : null}
                <h3 className="text-base font-bold text-slate-900">{feature.title || `Feature ${index + 1}`}</h3>
                {feature.description ? <p className="text-sm text-slate-600">{feature.description}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      <h2 className="mb-6 text-center text-2xl font-bold" style={{ color: theme.primary }}>{title || fallbackTitle}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = resolveBlockIcon(feature.icon);
          return (
            <div key={`${feature.title ?? "feature"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
              {feature.icon ? <Icon size={22} className="mb-3 text-slate-700" /> : null}
              <h3 className="text-lg font-bold text-slate-900">{feature.title || `Feature ${index + 1}`}</h3>
              {feature.description ? <p className="mt-2 text-sm text-slate-600">{feature.description}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function parseVideoEmbedSrc(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      return match ? `https://www.youtube.com/embed/${match[2]}` : null;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "facebook.com" || host === "fb.watch") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoEmbedView({ block, theme }: { block: { title?: string | null; url?: string | null }; theme: { primary: string } }) {
  const src = block.url ? parseVideoEmbedSrc(block.url) : null;
  if (!src) return null;

  return (
    <div className="lp-card rounded-3xl p-6 sm:p-8">
      {block.title ? <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.primary }}>{block.title}</h2> : null}
      <div className="aspect-video w-full overflow-hidden rounded-2xl">
        <iframe src={src} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={block.title || "Video"} />
      </div>
    </div>
  );
}

export function CountdownView({ block, theme }: { block: { message?: string | null; end_datetime?: string | null }; theme: { accent: string; buttonText: string } }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!block.end_datetime || now === null) return null;
  const end = new Date(block.end_datetime).getTime();
  const remaining = Math.max(0, end - now);
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);

  return (
    <div className="rounded-3xl p-5 text-center text-white sm:p-6" style={{ backgroundColor: theme.accent }}>
      {block.message ? <p className="mb-3 text-sm font-semibold sm:text-base">{block.message}</p> : null}
      <div className="flex items-center justify-center gap-3 text-white" style={{ color: theme.buttonText }}>
        {[["Days", days], ["Hours", hours], ["Min", minutes], ["Sec", seconds]].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-black/15 px-3 py-2">
            <div className="text-xl font-bold tabular-nums sm:text-2xl">{String(value).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpacerView({ block }: { block: { style?: string | null; size?: string | null } }) {
  const sizeClass = block.size === "sm" ? "h-6" : block.size === "lg" ? "h-20" : "h-12";
  if (block.style === "line") {
    return <div className={`flex items-center ${sizeClass}`}><div className="w-full border-t border-slate-200" /></div>;
  }
  if (block.style === "dots") {
    return (
      <div className={`flex items-center justify-center gap-2 ${sizeClass}`}>
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-300" />)}
      </div>
    );
  }
  return <div className={sizeClass} />;
}
