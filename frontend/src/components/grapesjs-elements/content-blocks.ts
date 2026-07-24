// Real content-bound GrapesJS component types (unlike the 5 decorative
// blocks in custom-elements.ts, these traits actually update the rendered
// markup — see the init()/binding wiring in register-elements.ts). Each
// type carries a stable `data-*` marker so the backend
// (GrapesJsContentSerializer) can regex-extract it back into the matching
// `content` array (features[]/reviews[]/carousel_images[]) instead of
// treating it as opaque freeform HTML.

export const CONTENT_FEATURE_ATTR = "data-content-feature";
export const CONTENT_REVIEW_ATTR = "data-content-review";
export const CONTENT_CAROUSEL_ATTR = "data-content-carousel";
export const CONTENT_CAROUSEL_IMAGES_ATTR = "data-carousel-images";
export const CONTENT_CAROUSEL_TITLE_ATTR = "data-carousel-title";

type TraitBinding = { trait: string; selector: string };

export const featureItemElement = {
  id: "content-feature-item",
  label: "Feature Item",
  category: "Content",
  attributes: { class: "fa fa-star" },
  traitBindings: [
    { trait: "featureTitle", selector: '[data-field="title"]' },
    { trait: "featureDescription", selector: '[data-field="description"]' },
  ] as TraitBinding[],
  traits: [
    { type: "text", name: "featureTitle", label: "Title", default: "ফিচার শিরোনাম" },
    { type: "text", name: "featureDescription", label: "Description", default: "ফিচার বর্ণনা এখানে লিখুন।" },
  ],
  content: `
    <div ${CONTENT_FEATURE_ATTR}="true" style="padding:20px;background:#fff;border-radius:8px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:12px;">
      <h3 data-field="title" style="font-size:18px;font-weight:600;margin:0 0 8px;">ফিচার শিরোনাম</h3>
      <p data-field="description" style="color:#6b7280;margin:0;">ফিচার বর্ণনা এখানে লিখুন।</p>
    </div>
  `,
};

export const reviewItemElement = {
  id: "content-review-item",
  label: "Review Item",
  category: "Content",
  attributes: { class: "fa fa-comment" },
  traitBindings: [
    { trait: "reviewQuote", selector: '[data-field="quote"]' },
    { trait: "reviewName", selector: '[data-field="name"]' },
  ] as TraitBinding[],
  traits: [
    { type: "text", name: "reviewQuote", label: "Quote", default: "এখানে গ্রাহকের মন্তব্য লিখুন।" },
    { type: "text", name: "reviewName", label: "Customer Name", default: "গ্রাহকের নাম" },
  ],
  content: `
    <div ${CONTENT_REVIEW_ATTR}="true" style="padding:20px;background:#f9fafb;border-left:4px solid #3B82F6;border-radius:8px;margin-bottom:12px;">
      <p data-field="quote" style="margin:0 0 8px;color:#374151;">"এখানে গ্রাহকের মন্তব্য লিখুন।"</p>
      <p data-field="name" style="margin:0;font-weight:600;">গ্রাহকের নাম</p>
    </div>
  `,
};

export const carouselBlockElement = {
  id: "content-carousel",
  label: "Image Carousel",
  category: "Content",
  attributes: { class: "fa fa-images" },
  traitBindings: [] as TraitBinding[],
  traits: [
    { type: "text", name: "carouselTitle", label: "Gallery Title", default: "ছবির গ্যালারি" },
  ],
  content: `
    <div ${CONTENT_CAROUSEL_ATTR}="true" ${CONTENT_CAROUSEL_TITLE_ATTR}="ছবির গ্যালারি" style="padding:16px;background:#f8fafc;border-radius:8px;margin-bottom:12px;">
      <p style="font-weight:600;margin:0 0 8px;">🖼️ ছবির গ্যালারি — নিচে ছবি টেনে আনুন</p>
      <div ${CONTENT_CAROUSEL_IMAGES_ATTR}="true" style="display:flex;gap:8px;flex-wrap:wrap;min-height:80px;border:1px dashed #94a3b8;padding:8px;"></div>
    </div>
  `,
};
