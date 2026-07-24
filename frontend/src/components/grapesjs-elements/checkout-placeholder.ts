// Marks where the real checkout form will appear on the live page. It is
// purely a visual placeholder inside the GrapesJS canvas — the actual
// checkout form is real React state/logic in public-landing-page-view.tsx
// and always renders after the page's other content, so this block is
// stripped out of the exported HTML on the backend (see
// GrapesJsContentSerializer::toContent, matched via the data attribute
// below) rather than being treated as real page content.
export const CHECKOUT_PLACEHOLDER_ATTR = "data-landing-checkout-placeholder";

export const checkoutPlaceholderElement = {
  id: "checkout-placeholder",
  label: "Products & Checkout",
  category: "Sections",
  content: `
    <div ${CHECKOUT_PLACEHOLDER_ATTR}="true" style="
      padding: 40px 20px;
      border: 2px dashed #94a3b8;
      border-radius: 12px;
      background: #f1f5f9;
      color: #475569;
      text-align: center;
      font-family: sans-serif;
    ">
      <p style="margin: 0; font-size: 16px; font-weight: 600;">🛒 আপনার চেকআউট ফর্ম এখানে দেখাবে</p>
    </div>
  `,
  attributes: { class: "fa fa-shopping-cart" },
};
