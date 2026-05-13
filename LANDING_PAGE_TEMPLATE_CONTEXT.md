# Landing Page Context - Naturiva Exact Clone (Locked)

Last updated: 2026-05-12  
Scope: Seller landing page system for exact Naturiva-style flow (single locked template)  
Status: Active source of truth

---

## 1) বর্তমান চাহিদা (Locked Requirement)

Business requirement এখন একদম পরিষ্কার:

- Seller এমন একটি landing page template পাবে যা `https://naturivabd.com/step/asthma-cure/` flow-এর খুব কাছাকাছি
- Seller layout/design/section order পরিবর্তন করতে পারবে না
- Seller শুধুমাত্র product অনুযায়ী content পরিবর্তন করবে: text, image, package, shipping fee, contact, policy links
- Checkout flow হবে single-page, COD-first, package নির্বাচন + shipping নির্বাচন + optional upsell

এই file-ই এই requirement-এর final implementation context।

---

## 2) Template Identity (Single Template Only)

System-এ এই scope-এর জন্য only one active template profile থাকবে:

- `template_code`: `naturiva_package_upsell`
- `layout_profile`: `naturiva_exact_clone_locked`
- `editor_mode`: `locked`

Note:

- Old flexible/multi-template context এই scope-এ applicable না।

---

## 3) Layout Contract (Non-Editable)

Seller নিচের structure পরিবর্তন করতে পারবে না:

1. Hero health headline
2. Video/Proof block
3. Review wall/carousel
4. Offer strip + CTA
5. Quick contact (call/WhatsApp)
6. Checkout block (package নির্বাচন -> billing -> shipping -> order summary -> upsell -> COD text -> submit)
7. Bottom call CTA
8. Policy footer

Locked rules:

- Section reorder নিষিদ্ধ
- Section hide/disable নিষিদ্ধ
- Billing field order পরিবর্তন নিষিদ্ধ
- Upsell block position পরিবর্তন নিষিদ্ধ
- Final confirm CTA position পরিবর্তন নিষিদ্ধ

---

## 4) Seller Editable Fields (Only Allowed Inputs)

Seller কেবল নিচের data পরিবর্তন করতে পারবে:

- Hero text: `title`, `subtitle`, `disclaimer`
- Proof: `video_url`, `review_images[]`
- Offer strip: CTA label + highlight lines
- Packages: name, subtitle, image, badge, price, default নির্বাচন
- Shipping options: label + fee
- Upsell: checkbox label, title, description, image, price
- Contact: call/WhatsApp numbers
- Policy URLs: privacy + terms
- Theme subset: primary/accent/button text color

---

## 5) Strict Data Schema (`content_json`)

```json
{
  "layout_profile": "naturiva_exact_clone_locked",
  "hero": {
    "title": "",
    "subtitle": "",
    "disclaimer": ""
  },
  "proof": {
    "video_url": "",
    "review_images": []
  },
  "offer_strip": {
    "cta_label": "অর্ডার করতে চাই",
    "package_highlights": [
      { "text": "", "emphasis": "" }
    ]
  },
  "contact": {
    "call_numbers": [],
    "whatsapp_numbers": []
  },
  "checkout": {
    "section_title": "",
    "packages": [
      {
        "id": "pkg_1m",
        "title": "",
        "subtitle": "",
        "price": 1800,
        "compare_at_price": null,
        "badge": "জনপ্রিয়",
        "image": "",
        "is_default": true
      }
    ],
    "billing_fields": {
      "name": true,
      "phone": true,
      "address": true,
      "country": true
    },
    "shipping_options": [
      { "id": "outside_dhaka", "label": "ঢাকা সিটির বাহিরে", "fee": 100, "is_default": true },
      { "id": "inside_dhaka", "label": "ঢাকা সিটিতে", "fee": 50, "is_default": false }
    ],
    "upsell": {
      "enabled": true,
      "checkbox_label": "খেজুর সহ নিতে চাই",
      "title": "One Time Special Offer",
      "description_html": "",
      "image": "",
      "price": 999
    },
    "cod_confirmation_text": "আমি অবশ্যই পণ্যটি রিসিভ করবো...",
    "submit_label": "Confirm Order"
  },
  "bottom_cta": {
    "text": "Click to Call",
    "phone": ""
  },
  "policy": {
    "privacy_url": "",
    "terms_url": ""
  },
  "theme": {
    "primary": "#0b7a2a",
    "accent": "#ff6a00",
    "button_text": "#ffffff"
  }
}
```

---

## 6) Validation Rules (Publish + Runtime)

- `packages`: min 2, max 4
- exactly one default package
- `shipping_options`: min 1, max 3
- Bangladeshi phone format required
- `privacy_url` + `terms_url` ছাড়া publish নিষিদ্ধ
- `upsell.price >= 0`
- Unknown JSON key reject (422)
- Unsafe HTML sanitize/strip (`description_html` allowlist only)

---

## 7) Pricing Calculation Contract

Client + server উভয় পাশে একই formula:

`total = selected_package_price + selected_shipping_fee + (upsell_checked ? upsell_price : 0)`

Rules:

- Submit button amount real-time update হবে
- Server-side total recalculate বাধ্যতামূলক
- Client total never trusted

---

## 8) API Contract (Current Scope)

### 8.1 Seller

- `GET /api/landing/templates/available`
  - return: `template_code`, `layout_profile`, `editor_mode`, `editable_fields_manifest`
- `POST /api/landing/pages`
- `PUT /api/landing/pages/{id}`
- `GET /api/landing/pages/{id}`
- `GET /api/landing/pages/{id}/preview?device=mobile`
- `PUT /api/landing/pages/{id}/publish`

### 8.2 Public

- `GET /store/{slug}`
- `POST /api/landing/track/view`
- `POST /api/landing/track/cta`

Guardrails:

- locked template payload-এ section reorder/change attempt reject
- disabled template create/edit attempt reject

---

## 9) Database Notes (Minimum)

### 9.1 `landing_templates`

- `code` = `naturiva_package_upsell`
- `layout_profile` (indexed)
- `editor_mode` enum (`locked`)
- `default_schema_json` (উপরের strict schema)
- `is_active`

### 9.2 `landing_pages`

- `template_id`
- `content_json`
- `renderer_version` (e.g. `naturiva-c2-v1`)
- `validation_snapshot_json`
- `status` (`draft`, `published`, `archived`)

---

## 10) Builder UX (Seller Side)

Wizard steps:

1. Hero + product copy
2. Review/proof media
3. Package setup
4. Shipping + upsell
5. Contact + policy
6. Mobile preview + publish

Mandatory UX:

- "Layout locked" badge visible
- Section drag/drop controls hide
- Live mobile preview default
- Price simulator visible while editing package/shipping/upsell

---

## 11) Compliance + Copyright Safety

- Structure clone allowed, কিন্তু source brand asset copy allowed না
- Default seed content হবে internal placeholder
- Seller uploaded content-এর দায় seller-এর
- Health claim text এ absolute cure statement avoid করার warning builder-এ দেখাতে হবে

---

## 12) Acceptance Criteria

1. Seller layout change করতে পারবে না
2. Seller text/image/package/shipping/upsell data পরিবর্তন করতে পারবে
3. Package + shipping + upsell অনুযায়ী total সঠিকভাবে update হবে
4. Confirm Order button-এ current total দেখাবে
5. Published public page mobile-friendly হবে
6. Order source `landing_page` হিসেবে existing order module-এ save হবে

---

## 13) Execution Priority

Phase 1:

- migration + schema seed (`naturiva_exact_clone_locked`)
- template availability API metadata

Phase 2:

- locked seller builder
- preview renderer + runtime calculation

Phase 3:

- public render hardening
- analytics + QA + UAT

---

## 14) Notes for Future Work

- এই scope-এ multi-template decision add করা যাবে না without business approval
- New template যোগ করতে হলে নতুন context file/version তৈরি করতে হবে
- এই file-এর বাইরে conflicting docs থাকলে এই file priority পাবে
