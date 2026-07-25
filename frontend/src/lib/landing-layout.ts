// Layout ordering for the no-code block builder (Phase 2).
//
// Old shape (Quick Edit, still written by that editor): `layout_order` is a
// flat array of 6 fixed GROUP-KEY strings — e.g.
// ["html_sections","carousel_images","features","faq","reviews","products"]
// — so re-ordering only ever moves an entire section type as a block.
//
// New shape (this builder): `layout_order` is a flat array of
// `{ type, id }` entries, ONE PER BLOCK INSTANCE, so individual items
// (a single FAQ, a single feature, a single video embed) can be reordered
// relative to each other and relative to items of a different type. The
// underlying content arrays (`content.features`, `content.faq`, etc.) stay
// exactly as they are — `layout_order` only describes render sequence.
//
// A page saved once in this builder is expected to always be reopened in
// this builder from then on (confirmed acceptable one-way conversion) —
// expandLegacyLayoutOrder() only needs to run once, on first load.

export type BlockType =
  | "html_sections"
  | "carousel_images"
  | "features"
  | "faq"
  | "reviews"
  | "rich_text_blocks"
  | "image_text_blocks"
  | "video_embeds"
  | "trust_badges"
  | "countdown_blocks"
  | "spacers"
  | "products";

export const BLOCK_TYPES: BlockType[] = [
  "html_sections",
  "image_text_blocks",
  "rich_text_blocks",
  "features",
  "trust_badges",
  "carousel_images",
  "video_embeds",
  "countdown_blocks",
  "reviews",
  "faq",
  "spacers",
  "products",
];

// "products" is the always-present structured checkout section — it has no
// backing content array of its own (it's landing_page_products) and is not
// addable/removable, only positionable.
export const SINGLETON_BLOCK_TYPES: BlockType[] = ["products"];

export type LayoutEntry = { type: BlockType; id: string };

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Ensures every item in a content array has a stable string `id`, without
 * mutating the input. Existing ids are preserved; missing ones are
 * synthesized so layout_order entries have something durable to reference.
 */
export function ensureItemIds<T extends Record<string, unknown>>(
  items: T[] | undefined | null,
  typeForId: string,
): Array<T & { id: string }> {
  return (items ?? []).map((item) => ({
    ...item,
    id: typeof item.id === "string" && item.id ? item.id : generateId(typeForId),
  }));
}

/**
 * Builds the flat, per-item `layout_order` for a page's content, handling
 * both shapes:
 *  - already-new-shape: array of `{type,id}` objects — validated/returned
 *    as-is (any entries pointing at ids that no longer exist are dropped;
 *    any items missing from layout_order are appended at the end so
 *    nothing silently disappears).
 *  - legacy shape: array of group-key strings — expanded into one entry
 *    per existing item in that group's current array order.
 *  - missing/empty: falls back to BLOCK_TYPES default order, one entry per
 *    existing item.
 *
 * `contentWithIds` must already have `id` on every block-array item (run
 * `ensureItemIds` first for each array).
 */
export function expandLegacyLayoutOrder(
  rawLayoutOrder: unknown,
  contentWithIds: Partial<Record<BlockType, Array<{ id: string }>>>,
): LayoutEntry[] {
  const idsByType = new Map<BlockType, Set<string>>();
  for (const type of BLOCK_TYPES) {
    idsByType.set(type, new Set((contentWithIds[type] ?? []).map((item) => item.id)));
  }

  const isNewShape = Array.isArray(rawLayoutOrder) && rawLayoutOrder.every((entry) => typeof entry === "object" && entry !== null && "type" in entry);

  let entries: LayoutEntry[] = [];

  if (isNewShape) {
    entries = (rawLayoutOrder as LayoutEntry[]).filter(
      (entry) => SINGLETON_BLOCK_TYPES.includes(entry.type) || idsByType.get(entry.type)?.has(entry.id),
    );
  } else if (Array.isArray(rawLayoutOrder) && rawLayoutOrder.every((entry) => typeof entry === "string")) {
    // Legacy group-key order — expand each group into its current items.
    for (const groupKey of rawLayoutOrder as string[]) {
      if (!BLOCK_TYPES.includes(groupKey as BlockType)) continue;
      const type = groupKey as BlockType;
      if (SINGLETON_BLOCK_TYPES.includes(type)) {
        entries.push({ type, id: type });
        continue;
      }
      for (const item of contentWithIds[type] ?? []) {
        entries.push({ type, id: item.id });
      }
    }
  }

  // Append anything not yet represented (new blocks added since, or no
  // layout_order at all) in default type order.
  const seen = new Set(entries.map((e) => `${e.type}:${e.id}`));
  for (const type of BLOCK_TYPES) {
    if (SINGLETON_BLOCK_TYPES.includes(type)) {
      if (!seen.has(`${type}:${type}`)) entries.push({ type, id: type });
      continue;
    }
    for (const item of contentWithIds[type] ?? []) {
      const key = `${type}:${item.id}`;
      if (!seen.has(key)) {
        entries.push({ type, id: item.id });
        seen.add(key);
      }
    }
  }

  return entries;
}

/** Identity pass used at save time — kept separate so the "this is the one
 * true shape we persist" intent is explicit at call sites. */
export function collapseLayoutOrder(entries: LayoutEntry[]): LayoutEntry[] {
  return entries;
}
