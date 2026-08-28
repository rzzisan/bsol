/**
 * Windowed page-number list for a pager: always the first and last page,
 * the current page ± `delta` neighbours, and "…" markers for any gap —
 * never every page number in a row (which, at a "100+ products" catalog
 * scale, meant dozens of page links crammed into one row with no wrap/
 * scroll handling — pre_launch_polish_context.md §ঙ).
 *
 * paginationRange(7, 20) -> [1, "…", 6, 7, 8, "…", 20]
 * paginationRange(1, 3)  -> [1, 2, 3]
 * paginationRange(1, 2)  -> [1, 2]      (no gap to bridge, no "…")
 */
export function paginationRange(current: number, last: number, delta = 1): Array<number | "…"> {
  if (last <= 1) return last === 1 ? [1] : [];

  const middle: number[] = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(last - 1, current + delta); i++) {
    middle.push(i);
  }

  const result: Array<number | "…"> = [1];
  const leftAnchor = middle.length ? middle[0] : last;
  const rightAnchor = middle.length ? middle[middle.length - 1] : 1;

  if (leftAnchor > 2) result.push("…");
  result.push(...middle);
  if (rightAnchor < last - 1) result.push("…");
  result.push(last);

  // De-duplicate the boundary case where `middle` already touches 1 or last.
  return result.filter((v, i) => v !== result[i - 1] || v === "…");
}
