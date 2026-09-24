"use client";

import { useEffect } from "react";

/**
 * Tables tagged `catv-cards` collapse into stacked cards on phones
 * (globals.css). A card cell has no column header, so this copies each
 * <th> text onto the matching <td> as `data-label`, which the CSS shows
 * above the value. Runs on any DOM change (language switch, new rows,
 * pagination) and only writes attributes that actually changed, so it
 * cannot loop on its own mutations (it observes childList/characterData,
 * not attributes).
 */
function labelTables() {
  document.querySelectorAll<HTMLTableElement>("table.catv-cards").forEach((table) => {
    const headRow = table.tHead?.rows[0];
    if (!headRow) return;

    const labels: string[] = [];
    Array.from(headRow.cells).forEach((th) => {
      const text = (th.textContent ?? "").trim();
      for (let i = 0; i < th.colSpan; i += 1) labels.push(text);
    });

    Array.from(table.tBodies).forEach((body) => {
      Array.from(body.rows).forEach((row) => {
        let col = 0;
        Array.from(row.cells).forEach((cell) => {
          const label = cell.colSpan > 1 ? "" : (labels[col] ?? "");
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
          col += cell.colSpan;
        });
      });
    });
  });
}

export default function TableCardLabels() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(labelTables);
    };

    labelTables();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
