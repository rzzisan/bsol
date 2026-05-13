# Funnel Builder Context — Elementor + CartFlows inspired SaaS

Last updated: 2026-05-12  
Scope: Seller-facing funnel/landing builder for the Hybrid Stack SaaS  
Status: Master implementation context ✅

> **Pivot notice:** পূর্বের landing-page builder direction এখন **superseded**. নতুন development শুধুমাত্র এই Funnel Builder context অনুযায়ী চলবে. Existing landing-page code যদি থাকে, সেটা শুধু backward-compatibility / reference হিসেবে ধরা হবে.

---

## 1) কেন এই ফাইল

এই document-এর লক্ষ্য হলো WordPress Elementor + CartFlows-style funnel builder experience-কে আমাদের SaaS application-এ কীভাবে বাস্তবায়ন করা হবে তার একটি **single source of truth** তৈরি করা।

এই context file follow করলে implementation-এর সময়:

- seller কীভাবে funnel তৈরি করবে তা পরিষ্কার থাকবে
- backend data model ও API contract consistent থাকবে
- frontend builder UI plan aligned থাকবে
- MVP থেকে advanced funnel flow পর্যন্ত roadmap থাকবে
- GitHub-based reference architecture থেকে শেখা patterns preserve থাকবে

---

## 2) Product goal

Seller যেন এই flow-তে কাজ করতে পারে:

1. **Choose Funnel Template**
2. **Edit with Drag & Drop**
3. **Attach Products / Packages**
4. **Set Upsell / Order Bump / Thank You page**
5. **Preview Mobile/Desktop**
6. **Publish to custom slug**
7. **Track conversions + orders**

এটা Elementor-এর page builder feel এবং CartFlows-এর funnel logic—দুটোর combination হওয়া উচিত, কিন্তু native SaaS architecture-এর সাথে।

---

## 3) Core product approach

### 3.1 What we should build

A **JSON-driven visual funnel builder** with:

- template gallery
- drag-and-drop sections/blocks
- rich text editing inside blocks
- product/package binding
- step-based funnel flow
- live preview
- responsive preview
- publish/version management
- analytics instrumentation

### 3.2 What we should not do

- WordPress Elementor বা CartFlows-এর proprietary code clone করা
- full CMS replace করা without structured node model
- seller-কে raw HTML/CSS দিয়ে overwhelm করা

### 3.3 Best fit architecture for this SaaS

A **hybrid builder**:

- **node tree / block editor** for visual layout
- **structured form settings** for block configuration
- **drag-drop sorting** for blocks and funnel steps
- **inline rich-text editing** for content-heavy areas
- **template presets** for fast start
- **publishable slug-based public pages** for live rendering

---

## 4) System architecture diagram

```mermaid
flowchart TD
  subgraph Seller_UI[Seller UI - Next.js]
    A1[Choose Funnel Template]
    A2[Drag & Drop Builder Canvas]
    A3[Block Settings Panel]
    A4[Product / Package Attach Panel]
    A5[Step Flow Manager]
    A6[Mobile/Desktop Preview]
    A7[Publish Button]
  end

  subgraph Admin_UI[Admin UI - Next.js]
    B1[Template Library]
    B2[Template Access Rules]
    B3[Template Enable/Disable]
    B4[Funnel Analytics]
  end

  subgraph API[Laravel API]
    C1[Template APIs]
    C2[Funnel / Page APIs]
    C3[Block Save / Reorder APIs]
    C4[Publish / Archive APIs]
    C5[Analytics APIs]
    C6[Order + Upsell APIs]
  end

  subgraph DB[PostgreSQL]
    D1[landing_templates]
    D2[landing_template_access_rules]
    D3[landing_pages]
    D4[landing_page_steps]
    D5[landing_page_blocks]
    D6[landing_page_products]
    D7[landing_page_order_bumps]
    D8[landing_page_upsells]
    D9[landing_page_analytics_daily]
    D10[funnel_flows]
    D11[funnel_flow_steps]
  end

  subgraph Public[Public Storefront]
    E1[Public /store/{slug}]
    E2[Checkout / order submit]
    E3[Upsell / thank-you pages]
  end

  subgraph Services[Shared Services]
    F1[Media upload/storage]
    F2[Search/slug generator]
    F3[Analytics event tracker]
    F4[Order creation service]
    F5[Preview mode handling]
  end

  A1 --> A2
  A2 --> A3
  A2 --> A4
  A2 --> A5
  A2 --> A6
  A7 --> C2
  B1 --> C1
  B2 --> C1
  B3 --> C1
  C1 --> D1
  C1 --> D2
  C2 --> D3
  C2 --> D4
  C2 --> D5
  C2 --> D6
  C2 --> D7
  C2 --> D8
  C3 --> D5
  C4 --> D3
  C5 --> D9
  C6 --> D3
  C6 --> D6
  C6 --> D8
  Public --> C6
  Public --> C5
  Services --> API
  API --> DB
```

---

## 5) Recommended implementation strategy

### 5.1 Chosen path

Use a **Craft.js-inspired content tree** for page composition, combined with **dnd-kit** for interaction and **Tiptap** for rich text nodes.

That gives us:

- stable node identity
- nested droppable canvases
- drag handle support
- keyboard/mouse/touch drag support
- content serialization
- easy preview rendering

### 5.2 Why this path works

- **Craft.js pattern**: node tree, canvas blocks, serializer/deserializer, custom component resolver
- **dnd-kit pattern**: modern drag sensors, overlays, collision handling, sortable containers
- **Tiptap pattern**: editable content inside blocks with node views/extensions
- **Builder.io pattern**: content model, live preview, publishable pages, model-based rendering

### 5.3 Recommended technical stack

Frontend:
- Next.js App Router
- React
- TypeScript
- dnd-kit
- Tiptap
- Zustand
- React Hook Form
- Zod
- Tailwind CSS + shadcn/ui

Backend:
- Laravel
- Sanctum
- PostgreSQL
- Redis for caching/queues if available

---

## 6) Seller workflow design

### 6.1 Choose Funnel Template

Seller প্রথমে template choose করবে:

- Education / product offer
- Story-driven checkout
- Package upsell flow
- Lead capture / lead magnet
- Simple product launch funnel

Template select করার পর:
- default blocks load হবে
- default styles/tokens apply হবে
- product slots visible হবে
- funnel step structure auto-generate হবে

### 6.2 Edit with Drag & Drop

Seller canvas-এর মধ্যে blocks drag করবে:

- hero
- trust bar
- benefits
- testimonials
- FAQ
- product cards
- package cards
- order form
- order bump
- upsell block
- thank-you block

Rules:
- section reordering allowed
- nested content allowed only in canvas blocks
- some blocks locked per template for conversion safety

### 6.3 Attach Products / Packages

Seller attach করবে:
- individual products
- bundles
- subscription/package offers
- custom price override
- default quantity
- featured priority

Rules:
- eligible product list শুধুমাত্র seller-owned active products
- package flow হলে package selector visible হবে
- order bump এবং upsell আলাদা binding রাখতে হবে

### 6.4 Set Upsell / Order Bump / Thank You page

CartFlows-style funnel feel দিতে:

- landing page থেকে checkout step
- checkout থেকে order bump
- payment confirmation পরে upsell
- শেষে thank-you page

Each step should support:
- step-specific blocks
- step-specific CTA
- step-specific tracking
- step-specific slug or nested route

### 6.5 Preview Mobile/Desktop

Preview should support:
- desktop width
- tablet width
- mobile width
- live CTA simulation
- form interaction preview
- step-by-step funnel preview

### 6.6 Publish to custom slug

Publish flow:
- validate required fields
- reserve unique slug
- save draft snapshot
- publish current version
- make page public on `/store/{slug}` or funnel step routes
- generate canonical share URL

### 6.7 Track conversions + orders

Track:
- page view
- CTA click
- checkout start
- order bump acceptance
- upsell acceptance
- order completion
- revenue

Metrics should be available by:
- page
- funnel step
- template
- date
- traffic source

---

## 7) Frontend builder UI plan

### 7.1 Layout

The builder should follow a familiar Elementor-like pattern:

- **Left sidebar**: block palette / funnel steps / templates
- **Center canvas**: live page preview and drag target area
- **Right sidebar**: selected block settings
- **Top bar**: save, preview, publish, device switcher, undo/redo

### 7.2 Main panels

#### Left panel
- Templates
- Blocks
- Funnel steps
- Saved sections
- Asset library

#### Center canvas
- page preview
- drag handles
- selection outline
- add-section drop zones
- responsive width switch

#### Right panel
- text settings
- image settings
- colors / spacing / typography
- product/package mapping
- visibility rules
- CTA settings
- step settings

### 7.3 Essential UX features

- block hover highlight
- block lock/unlock
- duplicate block
- delete block
- drag handle only for moveable blocks
- quick add section button
- autosave indicator
- unsaved changes warning
- template reset to default

### 7.4 Responsive controls

For each block:
- desktop padding/margin
- mobile spacing overrides
- font size overrides
- image crop alignment
- CTA size per breakpoint

### 7.5 Editing modes

- **Structure mode**: drag/drop and block order
- **Content mode**: text/image/product settings
- **Style mode**: theme tokens and spacing
- **Flow mode**: funnel steps and redirect rules

---

## 8) Database schema

> Naming should follow the existing Laravel/PostgreSQL conventions in the repo.

### 8.1 `landing_templates`
Shared template catalog managed by admin.

Fields:
- `id`
- `code` unique
- `name_bn`
- `name_en`
- `description_bn`
- `description_en`
- `thumbnail_url`
- `category`
- `default_schema_json`
- `is_active`
- `sort_order`
- `created_by`
- timestamps

### 8.2 `landing_template_access_rules`
Admin rules for package/template access.

Fields:
- `id`
- `template_id`
- `package_id` nullable
- `is_enabled`
- `created_by`
- timestamps

### 8.3 `funnels`
Funnel master record.

Fields:
- `id`
- `user_id`
- `name`
- `slug`
- `status` (`draft`, `published`, `archived`)
- `theme_tokens_json`
- `settings_json`
- `published_at`
- timestamps

### 8.4 `funnel_flows`
Optional explicit flow grouping for a funnel version.

Fields:
- `id`
- `funnel_id`
- `name`
- `version`
- `is_active`
- timestamps

### 8.5 `funnel_flow_steps`
Defines the funnel sequence.

Fields:
- `id`
- `funnel_flow_id`
- `step_type` (`landing`, `checkout`, `order_bump`, `upsell`, `thank_you`)
- `step_order`
- `page_id`
- `slug`
- `is_enabled`
- `settings_json`
- timestamps

### 8.6 `landing_pages`
Seller-owned editable pages.

Fields:
- `id`
- `user_id`
- `template_id`
- `title`
- `slug`
- `status`
- `public_url`
- `meta_title`
- `meta_description`
- `theme_tokens_json`
- `content_json`
- `published_at`
- timestamps

### 8.7 `landing_page_blocks`
Serialized blocks for drag/drop editor.

Fields:
- `id`
- `landing_page_id`
- `block_key`
- `block_type`
- `parent_block_id` nullable
- `sort_order`
- `locked`
- `visibility_rules_json`
- `settings_json`
- `content_json`
- timestamps

### 8.8 `landing_page_steps`
Per-page funnel step mapping.

Fields:
- `id`
- `landing_page_id`
- `step_type`
- `step_order`
- `page_id` nullable
- `settings_json`
- timestamps

### 8.9 `landing_page_products`
Attach products/packages to the page.

Fields:
- `id`
- `landing_page_id`
- `product_id`
- `custom_title` nullable
- `custom_price` nullable
- `default_qty`
- `display_order`
- `is_featured`
- timestamps

### 8.10 `landing_page_order_bumps`
Order bump items.

Fields:
- `id`
- `landing_page_id`
- `product_id`
- `title`
- `description`
- `bump_price`
- `is_active`
- `sort_order`
- timestamps

### 8.11 `landing_page_upsells`
Upsell offers.

Fields:
- `id`
- `landing_page_id`
- `product_id`
- `title`
- `description`
- `offer_price`
- `type` (`one_click`, `downsell`)
- `is_active`
- `sort_order`
- timestamps

### 8.12 `landing_page_analytics_daily`
Daily analytics rollup.

Fields:
- `id`
- `landing_page_id`
- `view_date`
- `total_views`
- `unique_visitors`
- `cta_clicks`
- `checkout_starts`
- `order_bumps_accepted`
- `upsells_accepted`
- `orders_completed`
- `revenue`
- timestamps

Unique key:
- (`landing_page_id`, `view_date`)

---

## 9) API contract

### 9.1 Admin APIs

- `GET /api/admin/landing/templates`
- `POST /api/admin/landing/templates`
- `PUT /api/admin/landing/templates/{id}`
- `PUT /api/admin/landing/templates/{id}/toggle`
- `PUT /api/admin/landing/templates/reorder`
- `GET /api/admin/landing/templates/access-rules`
- `PUT /api/admin/landing/templates/access-rules`

### 9.2 Seller funnel/page APIs

- `GET /api/landing/templates/available`
- `GET /api/landing/pages`
- `POST /api/landing/pages`
- `GET /api/landing/pages/{id}`
- `PUT /api/landing/pages/{id}`
- `PUT /api/landing/pages/{id}/publish`
- `PUT /api/landing/pages/{id}/archive`
- `GET /api/landing/pages/{id}/preview`
- `GET /api/landing/pages/{id}/analytics`

### 9.3 Funnel flow APIs

- `GET /api/funnels`
- `POST /api/funnels`
- `GET /api/funnels/{id}`
- `PUT /api/funnels/{id}`
- `PUT /api/funnels/{id}/publish`
- `POST /api/funnels/{id}/steps`
- `PUT /api/funnels/{id}/steps/reorder`
- `PUT /api/funnels/{id}/steps/{stepId}`
- `DELETE /api/funnels/{id}/steps/{stepId}`

### 9.4 Block editor APIs

- `POST /api/landing/pages/{id}/blocks`
- `PUT /api/landing/pages/{id}/blocks/{blockId}`
- `DELETE /api/landing/pages/{id}/blocks/{blockId}`
- `POST /api/landing/pages/{id}/blocks/reorder`
- `POST /api/landing/pages/{id}/blocks/duplicate`

### 9.5 Product binding APIs

- `GET /api/orders/create/bootstrap`
- `POST /api/landing/pages/{id}/products`
- `PUT /api/landing/pages/{id}/products/reorder`
- `POST /api/landing/pages/{id}/order-bumps`
- `POST /api/landing/pages/{id}/upsells`

### 9.6 Public APIs

- `GET /api/landing/public/{slug}`
- `POST /api/landing/public/{slug}/order`
- `POST /api/landing/track/view`
- `POST /api/landing/track/cta`
- `POST /api/landing/track/checkout-start`
- `POST /api/landing/track/order-bump`
- `POST /api/landing/track/order-complete`
- `POST /api/landing/track/upsell`

---

## 10) Frontend route plan

### Seller dashboard
- `/dashboard/funnels`
- `/dashboard/funnels/create`
- `/dashboard/funnels/[id]/edit`
- `/dashboard/funnels/[id]/preview`
- `/dashboard/funnels/[id]/analytics`
- `/dashboard/landing-pages`
- `/dashboard/landing-pages/create`
- `/dashboard/landing-pages/[id]/edit`
- `/dashboard/landing-pages/[id]/analytics`

### Admin dashboard
- `/admin/landing/templates`
- `/admin/landing/templates/access`
- `/admin/funnels`
- `/admin/funnels/templates`

### Public
- `/store/[slug]`
- `/checkout/[slug]`
- `/thank-you/[slug]`
- `/upsell/[slug]`

---

## 11) Editor component architecture

### 11.1 Recommended component layers

#### Shell layer
- top bar
- left panel
- canvas
- right settings panel
- preview modal/drawer

#### Data layer
- current funnel/page state
- selected block state
- template state
- publish state
- validation state

#### Node layer
- `FunnelNode`
- `StepNode`
- `SectionNode`
- `BlockNode`
- `ContentNode`

#### Rendering layer
- block registry
- block renderer
- step renderer
- responsive renderer
- public storefront renderer

### 11.2 State shape recommendation

Use a normalized editor state:

```ts
{
  page: { ... },
  template: { ... },
  blocksById: {},
  blockOrder: [],
  stepsById: {},
  stepOrder: [],
  productsById: {},
  settings: {},
  ui: {
    selectedBlockId: null,
    activePanel: 'content',
    viewport: 'desktop'
  }
}
```

### 11.3 Rendering strategy

- editor canvas should render from the same block schema as public page
- preview should use production renderer components
- avoid separate code paths for editor and public unless necessary

---

## 12) Suggested frontend technology choices

### Recommended libraries

- **dnd-kit**
  - drag and drop interactions
  - sortable lists
  - drag overlay
  - sensors and accessibility

- **Craft.js patterns**
  - node tree model
  - resolver registry
  - connected nodes/canvas blocks
  - serialization / deserialization

- **Tiptap**
  - inline rich text editing
  - custom node views
  - block embedded editors

- **Zustand**
  - lightweight builder state

- **React Hook Form + Zod**
  - schema-driven block forms

- **shadcn/ui + Tailwind**
  - fast polished admin/editor UI

### Optional advanced libraries

- `framer-motion` for smoother drag previews
- `react-easy-crop` for image editing
- `monaco-editor` only if custom HTML/CSS/JS blocks are allowed
- `react-virtual` for large block lists

---

## 13) How builder should work internally

### 13.1 Page composition model

A funnel page is composed of:
- page metadata
- theme tokens
- ordered blocks/sections
- attached products/packages
- funnel step links
- tracking settings

### 13.2 Block model

Each block should contain:
- `id`
- `type`
- `locked`
- `order`
- `data`
- `style`
- `visibility`
- `children` or nested canvas slots

### 13.3 Template model

Each template should contain:
- default block tree
- default theme tokens
- default copy
- block restrictions
- recommended product slots
- recommended funnel flow

### 13.4 Publish model

Publishing should:
- validate required blocks and fields
- generate or reserve slug
- store snapshot/version
- expose public content
- make analytics event-ready

---

## 14) Conversion tracking model

Track events at minimum:

- `page_view`
- `cta_click`
- `checkout_start`
- `order_bump_view`
- `order_bump_accept`
- `upsell_view`
- `upsell_accept`
- `thank_you_view`
- `order_complete`

Suggested payload:

```json
{
  "page_id": 123,
  "slug": "summer-offer",
  "funnel_id": 55,
  "step_type": "checkout",
  "event_name": "cta_click",
  "session_id": "...",
  "visitor_id": "...",
  "source": "facebook_ads",
  "device": "mobile",
  "timestamp": "..."
}
```

---

## 15) Seller experience rules

### Non-negotiable UX rules

- seller should start from template, not blank canvas
- default blocks should be conversion-optimized
- product attach should show only eligible products
- page publish should block if essentials missing
- preview should be one click away
- mobile preview must be available before publish

### Validation rules before publish

- title required
- template required
- at least one product/package required
- policy URLs required
- slug unique
- published steps valid
- upsell/order bump references valid if enabled

---

## 16) MVP feature roadmap

### Phase 1 — MVP foundation
- template gallery
- page builder shell
- section/blocks reorder
- product attach
- preview
- publish to slug
- public storefront render
- basic analytics

### Phase 2 — Funnel features
- funnel step manager
- checkout page
- order bump
- upsell step
- thank-you step
- step routing
- conversion tracking by step

### Phase 3 — Pro builder
- drag and drop across nested canvases
- reusable block library
- responsive block settings
- version history
- duplicate page / duplicate funnel
- custom domain support
- A/B testing

### Phase 4 — Scale and optimization
- collaborative editing
- asset CDN optimization
- reusable saved sections
- advanced analytics dashboard
- source-based attribution
- template marketplace

---

## 17) GitHub-based reference architecture research

> This section captures the useful patterns learned from public OSS projects. No code copying—only architecture and UX patterns.

### 17.1 Craft.js reference patterns

Repository: `prevwong/craft.js`

Useful patterns:
- `Editor` provides global editor state and resolver registry
- `Frame` defines editable area
- `Element` / canvas nodes define droppable regions
- `useEditor` / `useNode` expose state and connectors
- state serialization/deserialization is first-class
- connectors (`connect`, `drag`) attach interactivity to DOM
- node tree model makes nested editing manageable
- `query.serialize()` and `Frame data={...}` support load/save flows

Why it matters here:
- seller builder needs a node tree and serializable state
- canvas blocks and nested content map naturally to funnel sections
- resolver registry is ideal for our block library

### 17.2 dnd-kit reference patterns

Repository: `clauderic/dnd-kit`

Useful patterns:
- `DragDropProvider` / `DndContext` as root interaction layer
- sensors for pointer, keyboard, touch, mouse
- `DragOverlay` for smooth dragging visuals
- `useSortable` for reorderable lists
- collision detection strategies like `closestCenter`
- accessibility built in
- thin framework adapters over a core drag manager

Why it matters here:
- section reorder and funnel step reorder should feel polished
- keyboard accessibility matters for admin/seller usability
- drag overlay solves the “moving card” experience elegantly

### 17.3 Tiptap reference patterns

Repository: `ueberdosis/tiptap`

Useful patterns:
- Node extensions define editor behavior and schema
- node views allow custom DOM rendering
- `NodeViewWrapper` and `NodeViewContent` separate container vs editable content
- React node views support interactive components inside editor
- selection updates and content DOM are managed cleanly

Why it matters here:
- hero text, FAQ text, testimonials, button copy, and rich content need inline editing
- some blocks should have editable rich text while keeping structured block boundaries

### 17.4 Builder.io reference patterns

Repository: `BuilderIO/builder`

Useful patterns:
- content model + page model
- `fetchOneEntry` for fetching published or preview content
- `Content` renderer for public page output
- preview/edit mode support via query/search params
- models can represent pages, sections, and data content
- server-side loading of content by URL path
- custom components can be injected into the rendering pipeline

Why it matters here:
- public funnel pages should render from content model
- preview mode needs unpublished content visibility
- model-driven content fits our SaaS publish flow well

### 17.5 Practical synthesis for our SaaS

Use the best of all four:

- **Craft.js** → node tree and resolver pattern
- **dnd-kit** → interactive drag/drop UX
- **Tiptap** → editable rich text nodes
- **Builder.io** → page/content model and preview/publish flow

---

## 18) Recommended implementation order

### Step 1
Define funnel/page/block models and migration schema.

### Step 2
Create template library and access rules.

### Step 3
Build seller builder shell.

### Step 4
Implement node/block registry and preview renderer.

### Step 5
Implement product/package binding.

### Step 6
Implement funnel step manager.

### Step 7
Implement public storefront pages and tracking.

### Step 8
Add validation, publishing, analytics, and versioning.

---

## 19) Acceptance criteria

1. Seller can choose a funnel template
2. Seller can drag/drop sections and reorder them
3. Seller can attach products/packages
4. Seller can configure order bump and upsell
5. Seller can preview desktop/mobile
6. Seller can publish to a unique slug
7. Public page loads successfully
8. Orders are tracked with funnel source
9. Analytics reflect page and funnel events
10. Admin can control template availability

---

## 20) Notes for future development

- Keep all editor state serializable.
- Prefer a single canonical content schema for editor and public render.
- Treat templates as versioned starting points, not static locked pages.
- Build preview and public render from the same renderer whenever possible.
- Maintain admin control over seller visibility and access rules.
- Make publish flow strict enough to prevent broken conversion pages.

---

## 21) Legacy landing-page context to deprecate

The earlier landing-page builder direction is now deprecated as a standalone product path.

It should be treated only as:
- a reference for existing routes, models, and UI patterns
- a compatibility layer for any already-shipped screens
- a source of reusable pieces while building the funnel system

The current repo still has landing-page related implementation, but future work must be planned and shipped against this funnel builder context, not the old landing-page-only feature.

Relevant existing foundation:
- Laravel backend with Sanctum auth
- Next.js frontend app router
- seller dashboard menus already extended for landing pages
- admin landing template management already exists
- product bootstrap endpoint and landing page editor already exist

---

## 22) Execution log — Funnel Modules 1 থেকে 7 (কি/কেন/কিভাবে)

> Purpose: এই section-এ implementation history lock করা হলো, যাতে future contributor বুঝতে পারে কোন module-এ ঠিক কী কাজ হয়েছে, কেন হয়েছে, আর কিভাবে হয়েছে।

### Module 1 — Funnel foundation (Funnels CRUD + route shell)

**কি করা হয়েছে:**
- Seller-side funnel lifecycle APIs wired (`index/store/show/update/publish/archive/preview/analytics`).
- Dashboard funnel routes active করা হয়েছে (`/dashboard/funnels`, `/create`, `/[id]/edit`, `/preview`, `/analytics`).

**কেন করা হয়েছে:**
- Builder শুরু করার আগে funnel entity lifecycle stable না হলে step/block/editor layer build করা risky।

**কিভাবে করা হয়েছে:**
- Laravel `FunnelController` + authenticated routes ব্যবহার করে core funnel record management করা হয়েছে।
- Next.js app-router screens দিয়ে funnel orchestration shell ready করা হয়েছে।

### Module 2 — Editor shell + mode/view framework

**কি করা হয়েছে:**
- `funnel-editor-shell`-এ top action bar, mode switcher (`structure/content/style/flow`), viewport switcher (`desktop/tablet/mobile`) যোগ করা হয়েছে।
- Left/center/right panel ভিত্তিক editor skeleton established।

**কেন করা হয়েছে:**
- Elementor-like predictable UX ছাড়া পরের module-গুলো (flow/blocks/assets) fragmented হয়ে যেত।

**কিভাবে করা হয়েছে:**
- Component-driven shell architecture follow করে stateful editor layout (`left tab`, `selected step`, `selected block`) implement করা হয়েছে।

### Module 3 — Block system (palette + CRUD + inspector)

**কি করা হয়েছে:**
- Block registry-backed palette থেকে add block flow।
- Block list, select, update, delete, reorder implement।
- Inspector panel থেকে block settings/content save integration।

**কেন করা হয়েছে:**
- Funnel canvas-এর core value হচ্ছে block composition; এটা ছাড়া builder usable নয়।

**কিভাবে করা হয়েছে:**
- `landing_page_blocks` API set ব্যবহার করা হয়েছে (`store/index/update/destroy/reorder`)।
- Selected landing page context অনুযায়ী block cache (`blocksByPageId`) ব্যবহার করে faster editing experience রাখা হয়েছে।

### Module 4 — Publish/preview lifecycle integration

**কি করা হয়েছে:**
- Funnel `save`, `publish`, `archive`, `preview` actions UI + API wiring সম্পন্ন।
- Notice/feedback flow standardize করা হয়েছে।

**কেন করা হয়েছে:**
- Builder output market-ready করার জন্য draft→published lifecycle enforce করা দরকার।

**কিভাবে করা হয়েছে:**
- `PUT /api/funnels/{id}`, `/publish`, `/archive` endpoint integration এবং preview route link যুক্ত হয়েছে।

### Module 5 — Flow manager core (step CRUD + transitions)

**কি করা হয়েছে:**
- Funnel flow step create/update/delete/reorder UI implement।
- Step-level slug, enable/disable, success/failure transition config যুক্ত।

**কেন করা হয়েছে:**
- CartFlows-style step sequence (landing → checkout → bump/upsell → thank-you) enable করতে flow manager critical।

**কিভাবে করা হয়েছে:**
- `FunnelFlowStepController` APIs ব্যবহার করে flow-scoped step operations যুক্ত করা হয়েছে।
- Left tab step navigator + flow mode editor একসাথে synchronize করা হয়েছে।

### Module 6 — Flow validation hardening + regression safety

**কি করা হয়েছে:**
- Backend step rules harden (ownership, step invariants, transition reference integrity)।
- `AuthorizesRequests` trait issue fix করা হয়েছে base controller-এ।
- `/steps/reorder` route precedence fix করা হয়েছে (dynamic route conflict avoid)।
- Feature tests যোগ/পাস: flow-step API invariants।

**কেন করা হয়েছে:**
- Flow corruption, unauthorized link, এবং route conflict production failure তৈরি করছিল।

**কিভাবে করা হয়েছে:**
- `FunnelFlowStepController` validation paths tighten করা হয়েছে।
- API route order corrected; regression tests চালিয়ে verified করা হয়েছে।

### Module 7 — Assets / media integration (funnel editor)

**কি করা হয়েছে (initial delivery):**
- Assets tab-এ product-scoped media library integrate করা হয়েছে।
- Product list load, media policy load, gallery load, multi-upload, “Use in Block” action implement।
- Selected block-এ media URL apply করা হয়েছে (`content_json` + `settings_json` image/media key)।

**কেন করা হয়েছে:**
- Conversion pages-এ দ্রুত image swap/edit করার জন্য editor-native asset workflow দরকার ছিল।

**কিভাবে করা হয়েছে:**
- Existing product media endpoints reuse করা হয়েছে:
  - `GET /api/products/media-policy`
  - `GET /api/products/{id}/media`
  - `POST /api/products/{id}/media`
- Funnel editor state-এ product/media state যোগ করে Assets tab interactive করা হয়েছে।

**Module 7 solidification (2026-05-12 update):**
- `set-thumbnail` action যুক্ত হয়েছে (`PUT /api/products/{id}/media/{mediaId}/set-thumbnail`)।
- media delete action যুক্ত হয়েছে (`DELETE /api/products/{id}/media/{mediaId}`)।
- media reorder action যুক্ত হয়েছে (`PUT /api/products/{id}/media/reorder`)।
- apply-to-block reliability বাড়াতে save success check যোগ করা হয়েছে (success হলে তবেই applied notice)।
- Assets card controls এখন: reorder ↑↓, use in block, set thumbnail, delete।
- Upload UX polish: real-time upload progress (%) দেখানো হয়েছে।
- Media card selection UX: selected media highlight + selected badge যোগ করা হয়েছে।
- Delete safety: media delete-এর আগে confirmation prompt যোগ করা হয়েছে।

---

## 23) Verification snapshot (Modules 6–7 latest)

- Funnel step backend hardening regression passed (feature tests successful).
- Frontend build successful after Module 7 assets integration and solidification (`next build` pass).
- No TypeScript/diagnostic errors found in `frontend/src/components/funnel-editor-shell.tsx` after update.

---

## 24) Module 7 final completion + Module 8 kickoff (2026-05-12)

### 24.1 Module 7 completion (locked ✅)

Module 7 (Assets/media integration) formally completed with these final UX and safety outcomes:

- Product-scoped media load/upload/pick flow stable.
- Media operations complete: reorder, set thumbnail, delete.
- Upload UX improved with progress indicator.
- Selected media highlight + badge added for clearer operator flow.
- Delete confirmation added to reduce accidental removal.
- Apply-to-block reliability ensured (success-only notice).

### 24.2 Module 8 completed (public conversion event tracking) ✅

Module 8 is now completed with both backend endpoints and storefront event emitters.

Implemented APIs:

- `POST /api/landing/track/checkout-start`
- `POST /api/landing/track/order-bump`
- `POST /api/landing/track/order-complete`
- `POST /api/landing/track/upsell`

Supporting updates:

- `LandingTrackingController` expanded with new handlers.
- Daily analytics row creation hardened to avoid unique-key conflict race.
- `landing_page_analytics_daily` schema extended with:
  - `order_bumps_accepted`
  - `upsells_accepted`
- `LandingPageAnalyticsDaily` model fillable updated.
- Seller analytics summary now includes bump/upsell counters.
- Public storefront (`/store/[slug]`) now emits:
  - checkout-start when user moves into checkout CTA flow
  - upsell acceptance when upsell is selected and order succeeds
  - order-complete with revenue payload on successful order submission

### 24.3 Verification (Module 8 completion)

- Migration applied: `2026_05_12_140500_add_funnel_step_metrics_to_landing_page_analytics_daily`
- Backend tests passed: `LandingPageApiTest` → **7 passed** (37 assertions, includes order-bump/upsell/order-complete flow)
- Frontend production build passed (`next build`)

### 24.4 Next module kickoff (Module 9) ▶️

1. Add visitor/session identity (`session_id`, `visitor_id`, `device`, `source`) to tracking payload.
2. Build step-wise conversion ratio cards in analytics UI (view→checkout→order, bump, upsell).
3. Add thank-you and funnel-step attribution breakdowns for campaign/source analysis.
4. Add date-range + trend lines for conversion metrics.

---

## 25) Module 9 actual implementation completion (2026-05-12) ✅

### 25.1 Scope delivered

Module 9 এখন বাস্তব কোড-লেভেলে সম্পন্ন করা হয়েছে: attribution-rich tracking payload ingestion, conversion event persistence, unique visitor handling, এবং analytics intelligence response + UI surface।

### 25.2 Backend updates (Laravel)

- `LandingTrackingController`-এ shared payload validation hardened করা হয়েছে:
  - `session_id`, `visitor_id`, `source`, `device`, `country` support
  - সব conversion event endpoint-এ normalized metadata handling
- Conversion events persistence added via `landing_page_conversion_tracking` writes:
  - events: `page_view`, `cta_click`, `checkout_start`, `order_bump_accept`, `upsell_accept`, `order_complete`
- Daily unique visitor increment এখন guarded:
  - same `visitor_id` + day duplicate count avoid করার logic যুক্ত
- Existing daily row race-safe creation path preserved (`find/create/catch-retry`).

### 25.3 Analytics summary intelligence (Backend API response)

`LandingPageController@analytics` response এখন richer metrics দেয়:

- Core rates:
  - `view_to_checkout_rate`
  - `checkout_to_order_rate`
- Attribution buckets:
  - `attribution.sources[]`
  - `attribution.devices[]`

This enables seller-side campaign/channel style analysis directly from dashboard analytics page.

### 25.4 Frontend updates (Next.js)

- Public storefront `/store/[slug]` tracking payload এখন auto-build করে:
  - `session_id` (sessionStorage)
  - `visitor_id` (localStorage)
  - `source` (utm/referrer/direct fallback)
  - `device` (UA heuristic)
  - `country` (locale-derived fallback)
- Payload এখন view/cta/checkout-start/order-bump/upsell/order-complete calls-এ consistently যাচ্ছে।
- Landing analytics types (`src/lib/landing.ts`) expanded for new summary and attribution structures.
- Seller analytics UI (`/dashboard/landing-pages/[id]/analytics`) conversion ratio + attribution visibility-ready করা হয়েছে।

### 25.5 Test and build verification

Validated in this session:

- Backend feature test pass:
  - `php artisan test --filter=LandingPageApiTest`
  - Result: **7 passed (39 assertions)**
  - Includes conversion event + attribution payload assertions.
- Frontend production build pass:
  - `npm run build`
  - Result: successful compile + typecheck + static generation.

### 25.6 Module 9 status lock

Module 9 is now marked **completed** with code + validation evidence.

### 25.7 Next recommended module (Module 10) ▶️

1. Date-range filters (7/30/custom) in landing analytics API + UI.
2. Time-series trend charts for views/checkout/orders/revenue.
3. Source/device trend split by date for campaign diagnostics.
4. Exportable analytics snapshot (CSV) for seller reporting workflows.

---

## 26) Module 10 implementation progress (2026-05-12) ✅

### 26.1 Delivered in this iteration

Module 10-এর core analytics intelligence এখন code-level implemented এবং validated:

1. **Date-range analytics filter**
  - API supports `range=7d|30d|custom`
  - `custom` mode validates `start_date` and `end_date`
  - response returns normalized `range` metadata

2. **Time-series trend payload**
  - Per-day trend now returned for selected window
  - includes: `total_views`, `checkout_starts`, `orders_completed`, `revenue`
  - gap days are zero-filled for consistent chart rendering

3. **Attribution trend by date**
  - Source trend: grouped by `DATE(tracked_at)` + `source`
  - Device trend: grouped by `DATE(tracked_at)` + `device`
  - Existing source/device breakdown now respects selected date range

4. **Frontend analytics UI upgrade**
  - Range selector + custom start/end date inputs
  - Trend visualization (views/checkout/orders)
  - Source/device date-wise trend tables
  - Daily metrics table cleaned with bump/upsell columns

### 26.2 Verification snapshot

- Backend feature test:
  - `LandingPageApiTest` → **8 passed (47 assertions)**
  - Includes new test for date-range + trend payload
- Frontend production build:
  - `next build` → successful compile/typecheck/static generation

### 26.3 Remaining for Module 10 completion-plus

- CSV export endpoint + UI action (recommended next increment).

---

## 27) Ops incident note — frontend dashboard/style outage (2026-05-12)

### Symptoms

- `/dashboard` intermittently failed to load.
- CSS/static chunks under `/_next/static/chunks/*.css` returned `500` / `404`.
- Browser showed unstyled fallback or load failure.

### Root cause

- Next.js runtime user (`www-data`) could not write required runtime cache paths under `frontend/.next`.
- Log evidence: `EACCES: permission denied, mkdir '/var/www/hybrid-stack/frontend/.next/server/app/_not-found.segments'`.
- Supervisor also hit repeated `EADDRINUSE` because stale/overlapping port `3001` process attempts occurred during restart loops.

### Fix applied

1. Reset `.next` ownership to runtime user:
  - `www-data:www-data` on `frontend/.next` (recursive)
2. Ensured write permissions for owner on `.next`.
3. Performed clean frontend service recovery:
  - stop supervisor program
  - kill stale listeners on `127.0.0.1:3001`
  - start supervisor program fresh
4. Verified current dashboard CSS chunk resolved from live HTML returns `200`.

### Prevention guideline

- After production `next build`, ensure `.next` ownership stays with runtime service user before restart.
- Avoid parallel/manual `next start` while supervisor-managed process is active to prevent `EADDRINUSE` loops.

---

## 28) Ops incident note — login API server error (2026-05-12)

### Symptoms

- Frontend login showed `Server Error`.
- `POST /api/login` returned HTTP `500`.

### Root cause

- `backend/routes/api.php` had route references like `AuthController::class` without required `use` imports.
- Laravel failed route controller resolution with: `Target class [AuthController] does not exist`.

### Fix applied

1. Added missing controller imports in `routes/api.php`:
  - `AuthController`, `OtpController`, `EmailOtpController`, `PasswordResetController`
  - `Api\SmsAutomationController`, `Api\TransactionController`
2. Cleared Laravel route/optimize caches.
3. Re-tested `POST /api/login` and verified it now returns validation/auth response (`422`) instead of `500`.

