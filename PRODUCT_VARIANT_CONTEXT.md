# Product Variant System — Context & Implementation Blueprint

> This file is the single source of truth for building the product variant system in this Laravel + Next.js hybrid stack.
> Based on research from WooCommerce, Shopify, BigCommerce, and commercetools.

---

## 1. Core Concepts

### 1.1 Variant vs Modifier

| Concept | Definition | Example | Separate SKU? |
|---------|-----------|---------|---------------|
| **Variant** | A distinct sellable configuration with its own stock, price, and possibly image | Red / M shirt, 128GB iPhone | ✅ Yes |
| **Modifier** | A customization that doesn't change the core product identity | Gift wrap, engraving text, note card | ❌ No |

**Decision Rule:**
- Different stock level needed? → **Variant**
- Different price materially? → **Variant**
- Different shipping weight/dimensions? → **Variant**
- Customer wants to filter/search by it? → **Variant attribute**
- Just personalization with no stock impact? → **Modifier**

---

## 2. Platform Research Summary

### 2.1 WooCommerce Model
- **Structure**: Parent Product (variable) → Attributes (Color, Size) → Variations (each is a full product_id row)
- **Inventory**: Supports both parent-level and variation-level stock management (hybrid)
- **UX**: For 30+ variations, uses static dropdowns instead of AJAX for performance
- **Attribute scope**: Global (reusable across catalog) or local (product-specific)
- **Limits**: No hard cap on variations per product (but recommends <50 for UX)
- **Price**: Each variation can override parent price; if not set, falls back to parent

### 2.2 Shopify Model
- **Structure**: Product → Options (max 3: Color/Size/Material) → Variants (Cartesian product)
- **Hard limits**: Max **100 variants** per product, max **3 option types**
- **Inventory**: Per variant, per location (multi-location support)
- **Media**: Each variant can have its own image
- **Metafields**: Used for additional attribute data beyond the 3-option limit
- **Price**: Variant-level price is mandatory (no parent fallback)
- **SKU**: Variant-level SKU recommended but not mandatory

### 2.3 BigCommerce Model
- **Structure**: Product → Option Sets → Variants (combinations)
- **Enterprise**: Multi-Storefront (MSF) — Global attribute + per-channel locale override
- **Inventory**: Variant-level tracking with warehouse allocation
- **Modifiers**: Separated from variant-driving options; modifiers don't create new SKUs
- **Pricing rules**: Variant price rules (absolute or relative to base price)
- **Limits**: Up to 600 variants per product

### 2.4 commercetools Model
- **Structure**: Product Type (schema) → Product (master variant + variants array)
- **Attributes**: Defined in ProductType with typed schemas (enum, localizable string, money, etc.)
- **Limits**: Max **100 variants** per product
- **Prices**: Embedded in each variant as array of PriceDraft (supports multi-currency, channel, customer group)
- **Inventory**: Separate InventoryEntry resource, linked by SKU
- **Channels**: Sales channels and distribution channels are first-class citizens

---

## 3. Recommended Database Schema

### 3.1 Core Tables

```sql
-- Parent product (already exists, extend as needed)
products (
  id, name, slug, description,
  has_variants BOOLEAN DEFAULT FALSE,
  status, created_at, updated_at
)

-- Option types: Color, Size, Storage, etc.
product_options (
  id,
  product_id FK,
  name          VARCHAR(100),   -- "Color", "Size"
  display_name  VARCHAR(100),   -- "রঙ", "সাইজ" (localized)
  type          ENUM('select','color_swatch','image_swatch','text'),
  position      INT,            -- display order
  is_required   BOOLEAN DEFAULT TRUE
)

-- Option values: Red, Blue, M, L, 128GB
product_option_values (
  id,
  product_option_id FK,
  value         VARCHAR(100),   -- "Red"
  label         VARCHAR(100),   -- "লাল" (localized)
  color_hex     VARCHAR(7),     -- "#FF0000" for swatch
  image_url     VARCHAR(500),   -- for image swatch
  position      INT
)

-- Each variant = one sellable SKU combination
product_variants (
  id,
  product_id FK,
  sku           VARCHAR(100) UNIQUE NOT NULL,
  regular_price DECIMAL(12,2),
  discount      DECIMAL(12,2) DEFAULT 0,
  discount_type ENUM('amount','percent') DEFAULT 'amount',
  selling_price DECIMAL(12,2),  -- computed, stored for query performance
  cost_price    DECIMAL(12,2),
  stock_qty     INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  weight        DECIMAL(8,3),   -- kg
  image_url     VARCHAR(500),
  is_active     BOOLEAN DEFAULT TRUE,
  position      INT,
  created_at, updated_at
)

-- Maps variant to its option values (e.g., Red + M)
product_variant_option_values (
  id,
  product_variant_id FK,
  product_option_value_id FK,
  UNIQUE(product_variant_id, product_option_value_id)
)

-- Non-SKU customizations (gift wrap, engraving)
product_modifiers (
  id,
  product_id FK,
  name        VARCHAR(100),   -- "Gift Wrap"
  type        ENUM('checkbox','text','select','file','textarea'),
  is_required BOOLEAN DEFAULT FALSE,
  position    INT
)

product_modifier_values (
  id,
  product_modifier_id FK,
  label       VARCHAR(100),
  price_delta DECIMAL(10,2) DEFAULT 0,  -- extra charge for this option
  is_default  BOOLEAN DEFAULT FALSE
)
```

### 3.2 Optional Extension Tables

```sql
-- Multi-currency / multi-channel pricing
variant_prices (
  id,
  product_variant_id FK,
  currency_code CHAR(3),     -- BDT, USD
  channel       VARCHAR(50), -- "web", "pos", "wholesale"
  price         DECIMAL(12,2),
  valid_from    DATETIME,
  valid_until   DATETIME
)

-- Warehouse-level inventory (future multi-warehouse)
inventory_levels (
  id,
  product_variant_id FK,
  warehouse_id  FK,
  qty_available INT,
  qty_reserved  INT,
  qty_on_hand   INT GENERATED AS (qty_available + qty_reserved)
)
```

---

## 4. Attribute Taxonomy

| Category | Examples | Drives SKU? |
|----------|----------|-------------|
| **Identity** | Color, Size, Storage, Material | ✅ Yes |
| **Commercial** | Price, Cost, Tax class | Per-variant |
| **Presentation** | Swatch color, Display order, Variant image | Per-option-value |
| **Fulfillment** | Weight, Dimensions, Warehouse | Per-variant |
| **Compliance** | GTIN/barcode, HS code | Per-variant |
| **Customization** | Engraving text, Gift wrap, Note | ❌ No (Modifier) |

---

## 5. API Contract (Laravel Backend)

### 5.1 Endpoints to Build

```
GET    /api/products/{id}/variants          → list all variants with option values
POST   /api/products/{id}/variants          → create single variant
PUT    /api/products/{id}/variants/{vid}    → update variant
DELETE /api/products/{id}/variants/{vid}    → soft delete

GET    /api/products/{id}/options           → list option types + values
POST   /api/products/{id}/options           → create option (e.g., "Color")
POST   /api/products/{id}/options/{oid}/values → add option value (e.g., "Red")

POST   /api/products/{id}/variants/generate → bulk generate combinations
PUT    /api/products/{id}/variants/bulk     → bulk price/stock update
```

### 5.2 Variant Response Shape

```json
{
  "id": 12,
  "sku": "SHIRT-RED-M",
  "regular_price": "800.00",
  "discount": "100.00",
  "discount_type": "amount",
  "selling_price": "700.00",
  "stock_qty": 25,
  "image_url": "https://cdn.example.com/shirt-red.jpg",
  "is_active": true,
  "options": [
    { "option_name": "Color", "value": "Red", "color_hex": "#FF0000" },
    { "option_name": "Size",  "value": "M" }
  ]
}
```

### 5.3 Variant Generation Payload

```json
{
  "options": [
    { "name": "Color", "values": ["Red", "Blue", "Green"] },
    { "name": "Size",  "values": ["S", "M", "L", "XL"] }
  ],
  "default_price": 800,
  "default_discount": 0,
  "default_stock": 10,
  "sku_prefix": "SHIRT"
}
```
→ Generates up to 3×4 = 12 variants with auto SKU: `SHIRT-RED-S`, `SHIRT-RED-M`, etc.

---

## 6. Frontend UX Flows (Next.js Admin)

### 6.1 Product Create/Edit — Variants Tab

```
[Product Info Tab] [Pricing Tab] [Variants Tab] [Inventory Tab] [Media Tab]

Variants Tab:
┌─────────────────────────────────────────────────────────┐
│  ☑ This product has variants                            │
│                                                         │
│  Options:                                               │
│  + Add Option (e.g., Color)                             │
│    ├── Color: [Red ×] [Blue ×] [+ Add value]            │
│    └── Size:  [S ×] [M ×] [L ×] [+ Add value]          │
│                                                         │
│  [Generate All Combinations]                            │
│                                                         │
│  Variants (12):                                         │
│  ┌──────────────┬────────┬────────┬──────┬────────┐    │
│  │ SKU          │ Price  │ Stock  │ Img  │ Active │    │
│  ├──────────────┼────────┼────────┼──────┼────────┤    │
│  │ SHIRT-RED-S  │ 800    │ 10     │ 🖼   │ ✅     │    │
│  │ SHIRT-RED-M  │ 800    │ 10     │ 🖼   │ ✅     │    │
│  │ SHIRT-BLUE-S │ 850    │ 5      │ 🖼   │ ✅     │    │
│  └──────────────┴────────┴────────┴──────┴────────┘    │
│                                                         │
│  [Bulk Edit Selected] [Export CSV]                      │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Product Detail Page — Variant Selector

```
Product: Polo Shirt
┌──────────────────────────────────────┐
│  Color:  [● Red] [○ Blue] [○ Green]  │
│  Size:   [S] [M] [● L] [XL]         │
│                                      │
│  SKU: SHIRT-RED-L                    │
│  Regular Price: ৳800                 │
│  Discount: ৳100                      │
│  Selling Price: ৳700  ← live update  │
│  Stock: 15 pcs                       │
│                                      │
│  [Add to Order]                      │
└──────────────────────────────────────┘
```

### 6.3 Order Intake — Variant Selection

When user picks a product in the order form:
1. If `has_variants = true` → show variant picker modal
2. User selects option values → auto-resolves to matching variant
3. Fill `unit_price` from `variant.selling_price`
4. Fill `sku` from `variant.sku`

---

## 7. Laravel Model Relationships

```php
// Product.php
public function options()      { return $this->hasMany(ProductOption::class); }
public function variants()     { return $this->hasMany(ProductVariant::class); }
public function modifiers()    { return $this->hasMany(ProductModifier::class); }

// ProductOption.php
public function values()       { return $this->hasMany(ProductOptionValue::class); }
public function product()      { return $this->belongsTo(Product::class); }

// ProductVariant.php
public function product()      { return $this->belongsTo(Product::class); }
public function optionValues() { return $this->belongsToMany(ProductOptionValue::class, 'product_variant_option_values'); }

// computed selling price on save
protected static function booted()
{
    static::saving(function ($variant) {
        $variant->selling_price = $variant->discount_type === 'percent'
            ? max(0, $variant->regular_price * (1 - $variant->discount / 100))
            : max(0, $variant->regular_price - $variant->discount);
    });
}
```

---

## 8. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Correct Approach |
|---|---|---|
| Auto-generate all combinations blindly | Combinatorial explosion (3×4×5 = 60 variants for one product) | Generate then let user delete/disable unwanted rows |
| Null variant price with parent price fallback | Reporting and API inconsistency | Require price at variant level; copy parent on generate |
| SKU reuse across distinct sellables | Breaks inventory tracking | Enforce UNIQUE constraint on SKU |
| Modeling modifier as variant | Incorrect stock entries, phantom SKUs | Separate `product_modifiers` table |
| Storing selling_price only (not regular+discount) | Can't re-calculate, can't show discount badge | Always store both components |
| Flat attribute strings (color="Red,Blue") | No normalization, no swatch support | Normalized option/value tables |
| No position column on options/values | UI display order becomes random | Add `position INT` and sort by it |

---

## 9. Selling Price Computation (Shared Logic)

**Shared utility** already exists at `frontend/src/lib/pricing.ts`:

```typescript
export const computeSellingPrice = (
  regularPrice: number,
  discount: number,
  discountType: 'amount' | 'percent'
): number => {
  if (discountType === 'percent') {
    return Math.max(0, regularPrice * (1 - discount / 100));
  }
  return Math.max(0, regularPrice - discount);
};
```

This same logic must be replicated in:
- Laravel model `boot()` observer (above)
- Any queue job that recalculates prices
- Export/report generators

---

## 10. Implementation Order (Build Sequence)

### Phase 1 — Database (Backend)
- [ ] Migration: `product_options`
- [ ] Migration: `product_option_values`
- [ ] Migration: `product_variants`
- [ ] Migration: `product_variant_option_values`
- [ ] Migration: Add `has_variants` column to `products`
- [ ] Seeders for test data

### Phase 2 — Laravel API
- [ ] `ProductOption` model + controller
- [ ] `ProductOptionValue` model + controller
- [ ] `ProductVariant` model + controller (with selling_price observer)
- [ ] `ProductVariantController@generate` (bulk combination generator)
- [ ] `ProductVariantController@bulkUpdate` (price/stock bulk edit)
- [ ] API routes in `routes/api.php`
- [ ] Form requests + validation
- [ ] API resource classes for response shaping

### Phase 3 — Frontend Admin (Next.js)
- [ ] `VariantsTab` component (options editor + variant table)
- [ ] `OptionEditor` component (add/remove option types and values)
- [ ] `VariantTable` component (inline editable rows)
- [ ] `VariantGenerateModal` (preview combinations before generating)
- [ ] Integrate into product create/edit page as a new tab
- [ ] `VariantPicker` component for product detail page
- [ ] Update order intake form to resolve variant from selections

### Phase 4 — Order Integration
- [ ] When `product.has_variants = true` in order form → open `VariantPicker`
- [ ] `order_items` table: add `product_variant_id FK` column
- [ ] Order API: accept `product_variant_id`, pull price from variant
- [ ] Stock decrement on order confirm (from `product_variants.stock_qty`)

### Phase 5 — Optional/Advanced
- [ ] `product_modifiers` system
- [ ] Variant-level images with gallery
- [ ] Low stock alerts
- [ ] Barcode/SKU label generation
- [ ] CSV import/export for variants

---

## 11. Key Constraints & Limits

| Setting | Value | Source |
|---------|-------|--------|
| Max variants per product | **100** (recommended) | Shopify + commercetools cap |
| Max option types per product | **3–5** (recommended) | UX sanity limit |
| Max option values per type | **20** (recommended) | Dropdown UX limit |
| SKU | Required, UNIQUE | All platforms |
| Selling price | Computed + stored | Performance for queries |
| Stock | Per-variant (not parent) | When `has_variants = true` |

---

## 12. World-Class UX Rules (Applied)

### 12.1 Variant Image Strategy (Applied)

- **Do not force separate image for every variant**.
- Use **variant-specific image** when there is visible difference (color/material/pattern).
- Keep **size-only variants** on product-level image fallback.

Implemented fallback chain:
1. `product_variants.image_url`
2. matching option value image (`product_option_values.image_url`, especially `image_swatch`)
3. product thumbnail (`products.thumbnail`)

This gives Shopify/BigCommerce-style UX while reducing media management overhead.

### 12.2 Color Variant Naming & Visualization (Applied)

- For color attributes, show **swatch dot + label** (e.g., `● Red`, `● Blue`) instead of plain text only.
- Keep text labels visible for accessibility (do not rely on color alone).
- For very light colors, keep a border so swatch remains visible.

Implemented in variant table chips:
- `option_type = color_swatch` + `color_hex` renders colored indicator.
- Variant attribute chips are tinted with color-aware background/border.

### 12.3 Generation Resilience (Applied)

- Variant generation now gracefully handles duplicate SKU collisions.
- Duplicate or race-condition collisions are **skipped**, not fatal.
- API responds with summary (`created`, `skipped`, `total`) instead of HTTP 500.

---

## 13. Project Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | Laravel (PHP) |
| Database | MySQL |
| Auth | Laravel Sanctum / session |
| Queue | Laravel Queue (jobs) |
| File Storage | Local / S3 |
| Shared pricing | `frontend/src/lib/pricing.ts` |
| Tests | Jest + ts-jest (frontend), PHPUnit (backend) |
| Server | `127.0.0.1:3001` (Next.js prod) |
| Repo | `github.com/rzzisan/bsol.git` → `main` branch |

---

*Last updated: 2026-05-10 | Research sources: WooCommerce, Shopify, BigCommerce, commercetools*
