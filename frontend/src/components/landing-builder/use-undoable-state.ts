"use client";

import { useCallback, useState, type SetStateAction } from "react";

const HISTORY_LIMIT = 100;
// Changes closer together than this are one undo step, so typing a word is
// undone as a whole instead of letter by letter.
const COALESCE_MS = 800;

type History<T> = { past: T[]; present: T; future: T[]; lastChangeAt: number };

/**
 * State with undo/redo history. `setField(key)` returns a setState-style
 * setter for one key of the object, so existing `setX(value)` and
 * `setX((prev) => ...)` call sites keep working.
 */
export function useUndoableState<T extends object>(initial: () => T) {
  const [history, setHistory] = useState<History<T>>(() => ({ past: [], present: initial(), future: [], lastChangeAt: 0 }));

  const update = useCallback((updater: (prev: T) => T) => {
    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      const now = Date.now();
      const coalesce = now - h.lastChangeAt < COALESCE_MS;
      return {
        past: coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastChangeAt: now,
      };
    });
  }, []);

  const setField = useCallback(
    <K extends keyof T>(key: K) =>
      (value: SetStateAction<T[K]>) =>
        update((prev) => {
          const resolved = typeof value === "function" ? (value as (p: T[K]) => T[K])(prev[key]) : value;
          return Object.is(resolved, prev[key]) ? prev : { ...prev, [key]: resolved };
        }),
    [update],
  );

  const undo = useCallback(() => {
    setHistory((h) => (h.past.length === 0 ? h : {
      past: h.past.slice(0, -1),
      present: h.past[h.past.length - 1],
      future: [h.present, ...h.future],
      lastChangeAt: 0,
    }));
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => (h.future.length === 0 ? h : {
      past: [...h.past, h.present],
      present: h.future[0],
      future: h.future.slice(1),
      lastChangeAt: 0,
    }));
  }, []);

  // Makes the next change its own undo step (e.g. deleting a block right
  // after typing).
  const checkpoint = useCallback(() => {
    setHistory((h) => (h.lastChangeAt === 0 ? h : { ...h, lastChangeAt: 0 }));
  }, []);

  // Forget history, e.g. once the page has loaded so the first undo can't
  // step back into the empty pre-load form.
  const clearHistory = useCallback(() => {
    setHistory((h) => ({ past: [], present: h.present, future: [], lastChangeAt: 0 }));
  }, []);

  return {
    present: history.present,
    setField,
    undo,
    redo,
    checkpoint,
    clearHistory,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
