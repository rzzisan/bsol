"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type PreviewDevice = "mobile" | "desktop";

const DEVICE_WIDTH: Record<PreviewDevice, number> = { mobile: 390, desktop: 1280 };

const EMPTY_DOC = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>";

// Renders the live preview inside an iframe so the page's responsive
// breakpoints (Tailwind sm:/md:, which follow the viewport, not the
// container) match what a visitor on that device sees. The children are
// portaled in, so they stay part of the builder's React tree and update on
// every keystroke without serialising anything. The parent document's
// stylesheets are mirrored into the frame; desktop width is scaled down to
// fit the preview column.
export default function PreviewFrame({ device, children }: { device: PreviewDevice; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frameDoc = iframeRef.current?.contentDocument;
    if (!mountNode || !frameDoc) return;
    const sync = () => {
      frameDoc.head.querySelectorAll("[data-preview-style]").forEach((node) => node.remove());
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-preview-style", "");
        frameDoc.head.appendChild(clone);
      });
      // next/font variables and theme classes live on <html>/<body>.
      frameDoc.documentElement.className = document.documentElement.className;
      frameDoc.body.className = document.body.className;
      frameDoc.body.style.margin = "0";
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [mountNode]);

  // A ref callback rather than onLoad: when the frame is server-rendered its
  // srcdoc can finish loading before React hydrates and attaches handlers.
  const attachFrame = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe;
    if (!iframe) return;
    const mount = () => {
      const doc = iframe.contentDocument;
      if (doc?.body && doc.location.href === "about:srcdoc") setMountNode(doc.body);
    };
    mount();
    iframe.addEventListener("load", mount);
  }, []);

  const width = DEVICE_WIDTH[device];
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / width) : 1;

  return (
    <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden">
      <iframe
        ref={attachFrame}
        title="preview"
        srcDoc={EMPTY_DOC}
        className="absolute top-0 border-0 bg-white"
        style={{
          width,
          height: `${100 / scale}%`,
          left: scale < 1 ? 0 : `calc(50% - ${width / 2}px)`,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      />
      {mountNode ? createPortal(children, mountNode) : null}
    </div>
  );
}
